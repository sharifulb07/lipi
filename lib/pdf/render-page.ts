import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas,DOMMatrix,ImageData,Path2D } from "@napi-rs/canvas";
import { loadPdfJs } from "./pdfjs";

export interface RenderedPage {
  pageNumber:number;
  pdfWidth:number;
  pdfHeight:number;
  pixelWidth:number;
  pixelHeight:number;
  png:Uint8Array;
  imageType:"png"|"jpg";
}
export interface RenderOptions {
  format?:"png"|"jpeg";
  quality?:number;
  concurrency?:number;
  onPage?:(completed:number,total:number)=>void;
}

function adaptiveDpi(pageCount:number){return pageCount<=10?168:pageCount<=40?150:132}

export async function renderPages(buffer:Uint8Array,dpi=200,options:RenderOptions={}):Promise<RenderedPage[]>{
  Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
  const pdfjs=await loadPdfJs();
  const packageRoot=path.join(process.cwd(),"vendor","pdfjs");
  const directoryUrl=(directory:string)=>pathToFileURL(directory+path.sep).href;
  const pdf=await pdfjs.getDocument({
    data:buffer.slice(),useWorkerFetch:false,isEvalSupported:false,useSystemFonts:true,
    standardFontDataUrl:directoryUrl(path.join(packageRoot,"standard_fonts")),
    cMapUrl:directoryUrl(path.join(packageRoot,"cmaps")),cMapPacked:true,
  }).promise;
  const actualDpi=dpi>0?dpi:adaptiveDpi(pdf.numPages),format=options.format??"png";
  const output=new Array<RenderedPage>(pdf.numPages);
  let nextPage=1,completed=0;
  const renderNext=async()=>{
    while(true){
      const pageNumber=nextPage++;
      if(pageNumber>pdf.numPages)return;
      const page=await pdf.getPage(pageNumber),original=page.getViewport({scale:1}),viewport=page.getViewport({scale:actualDpi/72});
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext("2d");
      if(format==="jpeg"){context.fillStyle="#ffffff";context.fillRect(0,0,canvas.width,canvas.height)}
      await page.render({canvasContext:context as never,viewport}).promise;
      const encoded=format==="jpeg"?await canvas.encode("jpeg",options.quality??90):await canvas.encode("png");
      output[pageNumber-1]={pageNumber,pdfWidth:original.width,pdfHeight:original.height,pixelWidth:canvas.width,pixelHeight:canvas.height,png:new Uint8Array(encoded),imageType:format==="jpeg"?"jpg":"png"};
      page.cleanup();completed+=1;options.onPage?.(completed,pdf.numPages);
    }
  };
  try{
    const concurrency=Math.max(1,Math.min(options.concurrency??1,3,pdf.numPages));
    await Promise.all(Array.from({length:concurrency},()=>renderNext()));
    return output;
  }finally{await pdf.destroy()}
}

export async function renderPage(buffer:Uint8Array,pageNumber:number,dpi=200){
  const pages=await renderPages(buffer,dpi);
  const page=pages[pageNumber-1];
  if(!page)throw new Error("PDF page not found");
  return page;
}