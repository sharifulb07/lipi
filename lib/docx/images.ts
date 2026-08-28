import { ImageRun } from "docx";
export function createImage(data:Uint8Array,width:number,height:number){return new ImageRun({data,transformation:{width,height},type:"png"})}
