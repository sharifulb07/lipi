import type { ExtractedPage,PdfLine,PdfTable } from "../types";
import { extractRuledTables } from "./extract-ruled-tables";
import { loadPdfJs } from "./pdfjs";
interface Item { str:string; transform:number[]; width:number; height:number; fontName?:string }
interface TextStyle { fontFamily?:string }
type PdfOps=Record<string,number>;

function numericValues(value:unknown):number[]{
 if(value==null)return[];
 if(Array.isArray(value))return value.filter((item):item is number=>typeof item==="number");
 if(ArrayBuffer.isView(value))return Array.from(value as unknown as ArrayLike<number>);
 return[];
}
function component(value:number){return Math.max(0,Math.min(255,Math.round(value<=1?value*255:value)))}
function rgb(values:number[]){return values.slice(0,3).map(value=>component(value).toString(16).padStart(2,"0")).join("").toUpperCase()}
function textColors(list:{fnArray:number[];argsArray:unknown[]},ops:PdfOps){
 let fill="000000";const colors:string[]=[];
 for(let index=0;index<list.fnArray.length;index++){
  const fn=list.fnArray[index],rawArgs=list.argsArray[index];
  if(fn===ops.setFillRGBColor)fill=rgb(numericValues(rawArgs));
  else if(fn===ops.setFillGray){const gray=component(numericValues(rawArgs)[0]??0);fill=[gray,gray,gray].map(value=>value.toString(16).padStart(2,"0")).join("").toUpperCase()}
  else if(fn===ops.setFillCMYKColor){const [c=0,m=0,y=0,k=0]=numericValues(rawArgs).map(value=>value>1?value/255:value);fill=rgb([(1-c)*(1-k),(1-m)*(1-k),(1-y)*(1-k)])}
  else if(fn===ops.showText||fn===ops.showSpacedText||fn===ops.nextLineShowText||fn===ops.nextLineSetSpacingShowText)colors.push(fill);
 }
 return colors;
}

function joinItems(items:PdfLine[]){
 let text="",previous:PdfLine|undefined;
 for(const item of items){
  const gap=previous?item.x-(previous.x+previous.width):0;
  if(previous&&gap>Math.max(1.5,(item.height||10)*.18)&&!text.endsWith(" ")&&!item.text.startsWith(" "))text+=" ";
  text+=item.text; previous=item;
 }
 return text;
}

function alignmentForBounds(left:number,right:number,pageWidth:number):"left"|"center"|"right"{
 const leftSpace=left,rightSpace=Math.max(0,pageWidth-right);
 if(Math.abs(leftSpace-rightSpace)<=Math.max(6,pageWidth*.025))return "center";
 if(rightSpace<=pageWidth*.18&&leftSpace>=pageWidth*.45&&leftSpace>rightSpace*1.5)return "right";
 return "left";
}

function cellsForRow(row:PdfLine[]){
 const items=[...row].sort((a,b)=>a.x-b.x),cells:PdfLine[][]=[];
 for(const item of items){
  const current=cells.at(-1),previous=current?.at(-1);
  const gap=previous?item.x-(previous.x+previous.width):Infinity;
  if(!current||gap>Math.max(12,(item.height||10)*1.25))cells.push([item]);else current.push(item);
 }
 return cells.map(items=>({items,x:items[0].x,right:Math.max(...items.map(item=>item.x+item.width))}));
}

function extractTables(rows:Map<number,PdfLine[]>):{tables:PdfTable[];used:Set<number>}{
 const ordered=[...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([y,row])=>({y,cells:cellsForRow(row)}));
 const tables:PdfTable[]=[],used=new Set<number>();
 for(let start=0;start<ordered.length;){
  const first=ordered[start];
  if(first.cells.length<2){start++;continue}
  let end=start+1;
  while(end<ordered.length){
   const row=ordered[end],previous=ordered[end-1];
   if(row.cells.length!==first.cells.length||previous.y-row.y>Math.max(30,row.cells[0].items[0].height*2.5))break;
   if(row.cells.some((cell,index)=>Math.abs(cell.x-first.cells[index].x)>18))break;
   end++;
  }
  if(end-start<3){start++;continue}
  const group=ordered.slice(start,end),starts=first.cells.map(cell=>cell.x);
  const right=Math.max(...group.flatMap(row=>row.cells.map(cell=>cell.right)));
  const columnWidths=starts.map((x,index)=>(starts[index+1]??right)-x);
  const rowHeights=group.map((row,index)=>Math.max(12,(row.y-(group[index+1]?.y??(row.y-row.cells[0].items[0].height)) )));
  for(const row of group)used.add(row.y);
  tables.push({x:starts[0],y:group.at(-1)!.y,width:right-starts[0],height:rowHeights.reduce((a,b)=>a+b,0),columnWidths,rowHeights,rows:group.map(row=>row.cells.map(cell=>{const first=cell.items[0];return{text:joinItems(cell.items),fontName:first.fontName,fontFamily:first.fontFamily,fontSize:first.fontSize,color:first.color,bold:first.bold,italics:first.italics}})) });
  start=end;
 }
 return{tables,used};
}
export async function extractText(buffer:Uint8Array):Promise<{pages:ExtractedPage[];fonts:string[]}>{
 const pdfjs=await loadPdfJs();
 // PDF.js transfers the data buffer to its worker and may detach it. Clone the
 // bytes so callers can safely analyze and extract from the same upload.
 const pdf=await pdfjs.getDocument({data:buffer.slice(),useWorkerFetch:false,isEvalSupported:false,useSystemFonts:true}).promise; const pages:ExtractedPage[]=[]; const fonts=new Set<string>();
 for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){ const page=await pdf.getPage(pageNumber); const view=page.getViewport({scale:1}); const content=await page.getTextContent(); const operatorList=await page.getOperatorList();const colors=textColors(operatorList,pdfjs.OPS as PdfOps);let textIndex=0;const rows=new Map<number,PdfLine[]>(),allItems:PdfLine[]=[];
  for(const raw of content.items){if(!("str" in raw))continue;const color=colors[textIndex++]??"000000";if(!raw.str.trim())continue;const i=raw as Item,style=(content.styles[i.fontName??""]??{}) as TextStyle,family=style.fontFamily??i.fontName,y=Math.round(i.transform[5]/3)*3,fontSize=Math.hypot(i.transform[2],i.transform[3])||i.height,line={text:i.str,x:i.transform[4],y,width:i.width,height:i.height,fontName:i.fontName,fontFamily:family,fontSize,color,bold:/bold|black|heavy|semibold/i.test(family??""),italics:/italic|oblique/i.test(family??""),rotation:Math.atan2(i.transform[1],i.transform[0])*180/Math.PI};if(i.fontName)fonts.add(i.fontName);allItems.push(line);rows.set(y,[...(rows.get(y)??[]),line])}
  const ruled=extractRuledTables(operatorList,pdfjs.OPS,allItems);
  const remainingEntries:[number,PdfLine[]][]=[...rows].map(([y,row]):[number,PdfLine[]]=>[y,row.filter(item=>!ruled.used.has(item))]).filter((entry)=>entry[1].length>0);
  const remainingRows=new Map<number,PdfLine[]>(remainingEntries);
  const inferred=extractTables(remainingRows),tables=[...ruled.tables,...inferred.tables];
  const lines=[...remainingRows.entries()].filter(([y])=>!inferred.used.has(y)).map(([,row])=>row).sort((a,b)=>b[0].y-a[0].y).map(row=>{
   const items=row.sort((a,b)=>a.x-b.x);
   const text=joinItems(items);
   const left=items[0].x;
   const right=Math.max(...items.map(item=>item.x+item.width));
   const groups=cellsForRow(items);
   const spans=groups.map(group=>{const first=group.items[0];return{text:joinItems(group.items),x:group.x,width:group.right-group.x,fontName:first.fontName,fontFamily:first.fontFamily,fontSize:first.fontSize,color:first.color,bold:first.bold,italics:first.italics}});
   return{...items[0],text,width:right-left,sourceItems:items.length,spans:spans.length>1?spans:undefined,alignment:alignmentForBounds(left,right,view.width)};
  });pages.push({pageNumber,width:view.width,height:view.height,lines,tables});
 } return {pages,fonts:[...fonts]};
}
