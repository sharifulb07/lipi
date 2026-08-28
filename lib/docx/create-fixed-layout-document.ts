import { Document,FrameAnchorType,FrameWrap,HeightRule,HorizontalPositionRelativeFrom,ImageRun,Packer,PageOrientation,Paragraph,TabStopType,TextRun,VerticalPositionRelativeFrom } from "docx";
import type { ExtractedPage,PdfLine } from "../types";
import type { PositionedPdfImage } from "../pdf/extract-positioned-images";
import { fontForText,isRightToLeftText } from "./fonts";
import { createTable } from "./tables";

function alignmentFor(lines:PdfLine[]):"left"|"center"|"right"{
 const lefts=lines.map(line=>line.x),rights=lines.map(line=>line.x+line.width),centers=lines.map(line=>line.x+line.width/2);
 const spread=(values:number[])=>Math.max(...values)-Math.min(...values);
 if(spread(centers)<=Math.max(5,Math.max(...lines.map(line=>line.height))*.7))return "center";
 if(spread(rights)<spread(lefts))return "right";
 return "left";
}

function expandedLines(page:ExtractedPage){
 return page.lines.flatMap(line=>{
  if(!line.spans?.length)return line;
  const hasCompanion=page.lines.some(other=>other!==line&&Boolean(other.spans?.length)&&Math.abs(other.y-line.y)>0&&Math.abs(other.y-line.y)<=Math.max(other.height,line.height)*2.6);
  return hasCompanion?line.spans.map(span=>({...line,...span,text:span.text,x:span.x,width:span.width,spans:undefined})):line;
 });
}

function textBlocks(page:ExtractedPage){
 const blocks:PdfLine[][]=[];
 const regionFor=(line:PdfLine)=>page.tables.filter(table=>line.y<table.y).length;
 for(const line of expandedLines(page).sort((a,b)=>b.y-a.y||a.x-b.x)){
  const center=line.x+line.width/2;
  const candidates=blocks.filter(block=>{
   const last=block.at(-1)!;
   const vertical=last.y-line.y;
   const lastCenter=last.x+last.width/2;
   return regionFor(last)===regionFor(line)&&vertical>0&&vertical<=Math.max(last.height,line.height)*2.6&&Math.abs(lastCenter-center)<=Math.max(last.width,line.width)*.3;
  });
  const target=candidates.sort((a,b)=>Math.abs(a.at(-1)!.x+a.at(-1)!.width/2-center)-Math.abs(b.at(-1)!.x+b.at(-1)!.width/2-center))[0];
  if(target)target.push(line);else blocks.push([line]);
 }
 return blocks;
}

function fixedTextbox(page:ExtractedPage,lines:PdfLine[]){
 const ordered=[...lines].sort((a,b)=>b.y-a.y),left=Math.min(...ordered.map(line=>line.x)),right=Math.max(...ordered.map(line=>line.x+line.width));
 const top=Math.min(...ordered.map(line=>Math.max(0,page.height-line.y-line.height)));
 const bottom=Math.max(...ordered.map(line=>Math.max(0,page.height-line.y)));
 const lineHeight=Math.max(...ordered.map(line=>line.height||line.fontSize||10));
 const spans=ordered.length===1?ordered[0].spans:undefined;
 const children=spans?spans.flatMap((span,index)=>[
  ...(index?[new TextRun({text:"\t"})]:[]),
  new TextRun({text:span.text,rightToLeft:isRightToLeftText(span.text),font:fontForText(span.text,span.fontFamily),size:Math.max(8,Math.min(144,Math.round((span.fontSize||ordered[0].fontSize||lineHeight)*2))),color:span.color,bold:span.bold,italics:span.italics}),
 ]):ordered.map((line,index)=>new TextRun({text:line.text,break:index?1:undefined,rightToLeft:isRightToLeftText(line.text),font:fontForText(line.text,line.fontFamily),size:Math.max(8,Math.min(144,Math.round((line.fontSize||line.height||10)*2))),color:line.color,bold:line.bold,italics:line.italics}));
 const bidirectional=ordered.some(line=>isRightToLeftText(line.text));
 return new Paragraph({
  bidirectional,
  alignment:bidirectional?"right":spans?"left":alignmentFor(ordered),
  tabStops:spans?.slice(1).map(span=>({type:TabStopType.LEFT,position:Math.round((span.x-left)*20)})),
  spacing:{before:0,after:0,line:Math.max(20,Math.round(lineHeight*20)),lineRule:"exact"},
  frame:{type:"absolute",position:{x:Math.round(Math.max(0,left)*20),y:Math.round(top*20)},width:Math.round(Math.max(8,right-left+4)*20),height:Math.round(Math.max(8,bottom-top+lineHeight*.35)*20),anchor:{horizontal:FrameAnchorType.PAGE,vertical:FrameAnchorType.PAGE},wrap:FrameWrap.NONE,rule:HeightRule.EXACT,anchorLock:true},
  children,
 });
}

export async function createFixedLayoutDocument(textPages:ExtractedPage[],images:PositionedPdfImage[]=[]):Promise<Uint8Array>{
 const sections=textPages.map(page=>{
  const imageNodes=images.filter(image=>image.pageNumber===page.pageNumber).map((image,index)=>new Paragraph({spacing:{before:0,after:0,line:1},children:[new ImageRun({data:Buffer.from(image.data),type:"png",transformation:{width:image.width*96/72,height:image.height*96/72,rotation:image.rotation,flip:{horizontal:image.flipHorizontal,vertical:image.flipVertical}},floating:{horizontalPosition:{relative:HorizontalPositionRelativeFrom.PAGE,offset:Math.round(image.x*12700)},verticalPosition:{relative:VerticalPositionRelativeFrom.PAGE,offset:Math.round(image.top*12700)},behindDocument:true,allowOverlap:true,zIndex:-1000+index}})]}));
  const content=[
   ...textBlocks(page).map(lines=>({top:Math.min(...lines.map(line=>page.height-line.y-line.height)),node:fixedTextbox(page,lines)})),
   ...page.tables.map(table=>({top:page.height-table.y-table.height,node:createTable(table,page.height)})),
  ].sort((a,b)=>a.top-b.top).map(item=>item.node);
  return{properties:{page:{size:{width:Math.round(Math.min(page.width,page.height)*20),height:Math.round(Math.max(page.width,page.height)*20),orientation:page.width>page.height?PageOrientation.LANDSCAPE:PageOrientation.PORTRAIT},margin:{top:0,right:0,bottom:0,left:0,header:0,footer:0,gutter:0}}},children:[...imageNodes,...content]};
 });
 return new Uint8Array(await Packer.toBuffer(new Document({sections})));
}
