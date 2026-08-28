import { AlignmentType,Paragraph,TabStopType,TextRun } from "docx";
import type { PdfLine } from "../types";
import { fontForText,isRightToLeftText } from "./fonts";

function alignmentFor(line:PdfLine,pageWidth:number){
  if(line.alignment==="center")return AlignmentType.CENTER;
  if(line.alignment==="right")return AlignmentType.RIGHT;
  if(line.alignment==="left")return AlignmentType.LEFT;
  const left=line.x,right=pageWidth-line.x-line.width;
  if(left>24&&right>24&&Math.abs(left-right)<pageWidth*.09)return AlignmentType.CENTER;
  if(left>pageWidth*.55&&right<pageWidth*.15)return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

export function createParagraph(line:PdfLine,pageWidth:number){
  const size=Math.max(8,Math.min(144,Math.round((line.fontSize||line.height||11)*2)));
  const spans=line.spans?.length?line.spans:undefined;
  const alignment=spans?AlignmentType.LEFT:alignmentFor(line,pageWidth);
  const right=Math.max(0,pageWidth-line.x-line.width);
  const children=spans?spans.flatMap((span,index)=>[
    ...(index?[new TextRun({text:"\t"})]:[]),
    new TextRun({text:span.text,rightToLeft:isRightToLeftText(span.text),font:fontForText(span.text,span.fontFamily),size:Math.max(8,Math.min(144,Math.round((span.fontSize||line.fontSize||line.height||11)*2))),color:span.color,bold:span.bold,italics:span.italics}),
  ]):[new TextRun({text:line.text,rightToLeft:isRightToLeftText(line.text),font:fontForText(line.text,line.fontFamily),size,color:line.color,bold:line.bold,italics:line.italics})];
  const bidirectional=isRightToLeftText(line.text);
  return new Paragraph({
    bidirectional,
    alignment:bidirectional?AlignmentType.RIGHT:alignment,
    indent:spans?{left:Math.round(Math.max(0,spans[0].x)*20)}:alignment===AlignmentType.RIGHT?{right:Math.round(right*20)}:alignment===AlignmentType.CENTER?undefined:{left:Math.round(Math.max(0,line.x)*20)},
    tabStops:spans?.slice(1).map(span=>({type:TabStopType.LEFT,position:Math.round(span.x*20)})),
    spacing:{before:Math.max(0,Math.round((line.spacingBefore??0)*20)),after:Math.max(0,Math.round((line.spacingAfter??0)*20)),line:Math.max(20,Math.round((line.lineSpacing??line.height??11)*20)),lineRule:"exact"},
    children,
  });
}
