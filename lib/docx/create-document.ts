import { Document,Packer,PageOrientation,Paragraph } from "docx";
import type { ExtractedPage } from "../types";
import { createParagraph } from "./paragraphs";
import { documentStyles } from "./styles";
import { createTable } from "./tables";

function spacer(points:number){
 return new Paragraph({spacing:{before:Math.max(0,Math.round(points*20)),after:0,line:1,lineRule:"exact"}});
}

export async function createDocument(pages:ExtractedPage[]):Promise<Uint8Array>{
 const doc=new Document({styles:documentStyles,sections:pages.map(page=>{
  const content=[
   ...page.lines.map(line=>({kind:"line" as const,top:page.height-line.y-line.height,height:Math.max(line.height||0,line.fontSize||0,1),line})),
   ...page.tables.map(table=>({kind:"table" as const,top:page.height-table.y-table.height,height:table.height,table})),
  ].sort((a,b)=>a.top-b.top);
  const children:(Paragraph|ReturnType<typeof createTable>)[]=[],cursor={bottom:0};
  for(const item of content){
   const gap=Math.max(0,item.top-cursor.bottom);
   if(item.kind==="line"){
    item.line.lineSpacing=item.height;
    item.line.spacingBefore=gap;
    item.line.spacingAfter=0;
    children.push(createParagraph(item.line,page.width));
   }else{
    if(gap>.05)children.push(spacer(gap));
    children.push(createTable(item.table));
   }
   cursor.bottom=Math.max(cursor.bottom,item.top+item.height);
  }
  return{
   properties:{page:{
    size:{width:Math.round(Math.min(page.width,page.height)*20),height:Math.round(Math.max(page.width,page.height)*20),orientation:page.width>page.height?PageOrientation.LANDSCAPE:PageOrientation.PORTRAIT},
    margin:{top:0,right:0,bottom:0,left:0,header:0,footer:0,gutter:0},
   }},
   children,
  };
 })});
 return new Uint8Array(await Packer.toBuffer(doc));
}
