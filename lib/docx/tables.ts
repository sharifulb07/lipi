import {
 AlignmentType,BorderStyle,HeightRule,Paragraph,Table,TableAnchorType,TableCell,TableLayoutType,
 TableRow,TextDirection,TextRun,VerticalAlign,WidthType,
} from "docx";
import type { PdfTable } from "../types";
import { fontForText,isRightToLeftText } from "./fonts";

const border={style:BorderStyle.SINGLE,size:4,color:"000000"};

export function createTable(table:PdfTable,pageHeight?:number){
 const columnWidths=table.columnWidths.map(width=>Math.max(1,Math.round(width*20)));
 return new Table({
 width:{size:Math.round(table.width*20),type:WidthType.DXA},
  ...(!pageHeight?{indent:{size:Math.round(Math.max(0,table.x)*20),type:WidthType.DXA}}:{}),
  columnWidths,
  layout:TableLayoutType.FIXED,
  borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border},
  margins:{top:0,bottom:0,left:20,right:20},
  ...(pageHeight?{float:{
   horizontalAnchor:TableAnchorType.PAGE,verticalAnchor:TableAnchorType.PAGE,
   absoluteHorizontalPosition:Math.round(table.x*20),
   absoluteVerticalPosition:Math.round((pageHeight-table.y-table.height)*20),
   leftFromText:0,rightFromText:0,topFromText:0,bottomFromText:0,
  }}:{}),
  rows:table.rows.map((row,rowIndex)=>new TableRow({
   cantSplit:true,
   height:{value:Math.max(1,Math.round(table.rowHeights[rowIndex]*20)),rule:HeightRule.EXACT},
   children:row.map((cell,columnIndex)=>{
    const startColumn=row.slice(0,columnIndex).reduce((sum,item)=>sum+(item.columnSpan??1),0);
    const cellWidth=columnWidths.slice(startColumn,startColumn+(cell.columnSpan??1)).reduce((sum,width)=>sum+width,0);
    return new TableCell({
    width:{size:cellWidth,type:WidthType.DXA},
    columnSpan:cell.columnSpan,
    textDirection:cell.rotation==null||Math.abs(cell.rotation)<=45
     ?undefined
     :cell.rotation>0
      ?TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT
      :TextDirection.TOP_TO_BOTTOM_RIGHT_TO_LEFT,
    verticalAlign:cell.verticalAlignment==="top"?VerticalAlign.TOP:cell.verticalAlignment==="bottom"?VerticalAlign.BOTTOM:VerticalAlign.CENTER,
    shading:cell.shading?{fill:cell.shading,color:"auto"}:undefined,
    children:[new Paragraph({bidirectional:isRightToLeftText(cell.text),alignment:isRightToLeftText(cell.text)?AlignmentType.RIGHT:cell.alignment==="right"?AlignmentType.RIGHT:cell.alignment==="center"?AlignmentType.CENTER:AlignmentType.LEFT,spacing:{before:0,after:0,line:Math.max(20,Math.round((cell.fontSize||table.rowHeights[rowIndex]*.7)*20)),lineRule:"exact"},children:[new TextRun({text:cell.text,rightToLeft:isRightToLeftText(cell.text),font:fontForText(cell.text,cell.fontFamily),size:Math.max(8,Math.min(144,Math.round((cell.fontSize||table.rowHeights[rowIndex]*.7)*2))),color:cell.color,bold:cell.bold,italics:cell.italics})]})],
   });
   }),
  }))
 });
}



