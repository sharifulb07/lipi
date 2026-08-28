import type { PdfLine,PdfTable,PdfTableCell } from "../types";

type OperatorList={fnArray:number[];argsArray:unknown[]};
type Ops={constructPath:number;eoFill:number;setFillRGBColor:number};
type Rectangle={x:number;y:number;width:number;height:number;color:string};

const values=(value:unknown):number[]=>{
 if(value==null)return[];
 if(Array.isArray(value))return value.filter((item):item is number=>typeof item==="number");
 if(ArrayBuffer.isView(value))return Array.from(value as unknown as ArrayLike<number>);
 return[];
};
const close=(a:number,b:number,tolerance=1.2)=>Math.abs(a-b)<=tolerance;
function unique(values:number[]){const result:number[]=[];for(const value of values.sort((a,b)=>a-b))if(!result.some(item=>close(item,value)))result.push(value);return result}

export function extractRuledTables(list:OperatorList,ops:Ops,items:PdfLine[]):{tables:PdfTable[];used:Set<PdfLine>}{
 let path:Rectangle|undefined,fill="000000";const rectangles:Rectangle[]=[];
 for(let index=0;index<list.fnArray.length;index++){
  const fn=list.fnArray[index],args=list.argsArray[index];
  if(fn===ops.setFillRGBColor){const rgb=values(args);fill=rgb.slice(0,3).map(value=>Math.round(value).toString(16).padStart(2,"0")).join("").toUpperCase()}
  if(fn===ops.constructPath){const parts=Array.isArray(args)?args:[];const box=values(parts[1]);if(box.length>=4)path={x:box[0],y:box[1],width:box[2],height:box[3],color:fill}}
  if(fn===ops.eoFill&&path){rectangles.push(path);path=undefined}
 }
 const horizontal=rectangles.filter(rect=>rect.width>100&&rect.height<=2).sort((a,b)=>a.y-b.y);
 const groups:Rectangle[][]=[];
 for(const line of horizontal){const group=groups.at(-1);if(!group||line.y-group.at(-1)!.y>55)groups.push([line]);else if(!group.some(item=>close(item.y,line.y)))group.push(line)}
 const used=new Set<PdfLine>(),tables:PdfTable[]=[];
 for(const group of groups.filter(group=>group.length>=3&&group.at(-1)!.y-group[0].y>35)){
  const left=Math.min(...group.map(line=>line.x)),right=Math.max(...group.map(line=>line.x+line.width));
  const rowLines=unique(group.map(line=>line.y+line.height/2)),bottom=rowLines[0],top=rowLines.at(-1)!;
  const vertical=rectangles.filter(rect=>rect.width<=2&&rect.height>8&&rect.x>=left-2&&rect.x<=right+2&&rect.y<top&&rect.y+rect.height>bottom);
  const columns=unique([left,right,...vertical.map(line=>line.x+line.width/2)]);
  if(columns.length<3)continue;
  const rows:PdfTableCell[][]=[],rowHeights:number[]=[];
  for(let rowIndex=rowLines.length-2;rowIndex>=0;rowIndex--){
   const low=rowLines[rowIndex],high=rowLines[rowIndex+1],active=unique([left,right,...vertical.filter(line=>line.y<=low+1&&line.y+line.height>=high-1).map(line=>line.x+line.width/2)]);
   const row:PdfTableCell[]=[];
   for(let cellIndex=0;cellIndex<active.length-1;cellIndex++){
    const x1=active[cellIndex],x2=active[cellIndex+1];
    const content=items.filter(item=>!used.has(item)&&item.x>=x1-2&&item.x<=x2+2&&item.y>=low-2&&item.y<=high+3);
    content.forEach(item=>used.add(item));
    const text=content.sort((a,b)=>b.y-a.y||a.x-b.x).map(item=>item.text).join(" ");
    const start=Math.max(0,columns.findIndex(column=>close(column,x1))),end=Math.max(start+1,columns.findIndex(column=>close(column,x2)));
    const shade=rectangles.find(rect=>rect.color!=="000000"&&rect.x<x2&&rect.x+rect.width>x1&&rect.y<high&&rect.y+rect.height>low);
    const first=content[0];
    const rotated=content.find(item=>Math.abs(item.rotation??0)>45);
    // The first (top) table row is the schedule header. Force all labels—including
    // dates and totals—to Word's bottom-to-top vertical direction.
    const headerRotation=rows.length===0?90:rotated?.rotation;
    const contentLeft=content.length?Math.min(...content.map(item=>item.x)):x1;
    const contentRight=content.length?Math.max(...content.map(item=>item.x+item.width)):x2;
    const contentBottom=content.length?Math.min(...content.map(item=>item.y-item.height*.25)):low;
    const contentTop=content.length?Math.max(...content.map(item=>item.y+item.height)):high;
    const leftGap=contentLeft-x1,rightGap=x2-contentRight,bottomGap=contentBottom-low,topGap=high-contentTop;
    const horizontalTolerance=Math.max(2,(x2-x1)*.08),verticalTolerance=Math.max(2,(high-low)*.1);
    const alignment=Math.abs(leftGap-rightGap)<=horizontalTolerance?"center":leftGap>rightGap?"right":"left";
    const verticalAlignment=Math.abs(bottomGap-topGap)<=verticalTolerance?"center":bottomGap>topGap?"top":"bottom";
    row.push({text,fontName:first?.fontName,fontFamily:first?.fontFamily,fontSize:first?.fontSize,color:first?.color,bold:first?.bold,italics:first?.italics,columnSpan:end-start,rotation:headerRotation,alignment,verticalAlignment,shading:shade?.color});
   }
   rows.push(row);rowHeights.push(high-low);
  }
  tables.push({x:left,y:bottom,width:right-left,height:top-bottom,columnWidths:columns.slice(0,-1).map((column,index)=>columns[index+1]-column),rowHeights,rows});
 }
 return{tables,used};
}




