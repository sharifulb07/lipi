import { Document,ImageRun,Packer,PageOrientation,Paragraph } from "docx";
import type { RenderedPage } from "../pdf/render-page";

export async function createLayoutDocument(pages:RenderedPage[]):Promise<Uint8Array>{
  const doc=new Document({sections:pages.map(page=>({
    properties:{
      page:{
        size:{width:Math.round(Math.min(page.pdfWidth,page.pdfHeight)*20),height:Math.round(Math.max(page.pdfWidth,page.pdfHeight)*20),orientation:page.pdfWidth>page.pdfHeight?PageOrientation.LANDSCAPE:PageOrientation.PORTRAIT},
        margin:{top:0,right:0,bottom:0,left:0,header:0,footer:0,gutter:0},
      },
    },
    children:[new Paragraph({
      spacing:{before:0,after:0,line:1},
      children:[new ImageRun({
        data:Buffer.from(page.png),
        type:"png",
        transformation:{width:page.pdfWidth*96/72,height:page.pdfHeight*96/72},
      })],
    })],
  }))});
  return new Uint8Array(await Packer.toBuffer(doc));
}

