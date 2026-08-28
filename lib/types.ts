export type ConversionLanguage = "auto" | "eng" | "chi_sim" | "hin" | "spa" | "fra" | "ara" | "ben" | "rus" | "por" | "urd" | "ind" | "deu" | "jpn" | "pcm" | "mar" | "tel" | "tur" | "tam" | "chi_tra" | "vie" | "ben+eng";
export type ConversionMode = "fixed-layout" | "editable" | "preserve-layout";
export type PdfKind = "unicode" | "legacy" | "scanned" | "mixed";
export type JobStatus = "uploaded" | "queued" | "analyzing" | "extracting" | "normalizing" | "generating" | "completed" | "failed";
export interface ConversionOptions { language:ConversionLanguage; mode:ConversionMode; ocr:boolean }
export interface PdfTextStyle { fontFamily?:string; fontSize?:number; color?:string; bold?:boolean; italics?:boolean }
export interface PdfTextSpan extends PdfTextStyle { text:string; x:number; width:number; fontName?:string }
export interface PdfLine extends PdfTextStyle { text:string; x:number; y:number; width:number; height:number; fontName?:string; sourceItems?:number; spans?:PdfTextSpan[]; rotation?:number; alignment?:"left"|"center"|"right"; spacingBefore?:number; spacingAfter?:number; lineSpacing?:number }
export interface PdfTableCell extends PdfTextStyle { text:string; fontName?:string; columnSpan?:number; rotation?:number; alignment?:"left"|"center"|"right"; verticalAlignment?:"top"|"center"|"bottom"; shading?:string }
export interface PdfTable { x:number; y:number; width:number; height:number; columnWidths:number[]; rowHeights:number[]; rows:PdfTableCell[][] }
export interface ExtractedPage { pageNumber:number; width:number; height:number; lines:PdfLine[]; tables:PdfTable[] }
export interface PdfAnalysis { kind:PdfKind; pages:number; textCharacters:number; banglaCharacters:number; confidence:number; fonts:string[] }
export interface ConversionJob { id:string; fileName:string; fileSize:number; status:JobStatus; progress:number; message:string; createdAt:string; updatedAt:string; inputKey:string; outputKey?:string; options?:ConversionOptions; analysis?:PdfAnalysis; error?:string }


