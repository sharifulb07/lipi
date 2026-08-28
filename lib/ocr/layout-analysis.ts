export interface OcrBlock { text:string; x:number; y:number; width:number; height:number; confidence:number }
export function analyzeLayout(blocks:OcrBlock[]):OcrBlock[]{ return [...blocks].sort((a,b)=>a.y-b.y||a.x-b.x) }
