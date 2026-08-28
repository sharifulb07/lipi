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
}

export async function renderPages(buffer:Uint8Array,dpi=200):Promise<RenderedPage[]>{
  // PDF.js builds font outlines as Path2D instances. Its Node fallbacks can
  // come from a different module instance than the native canvas context,
  // which makes ctx.fill(path) reject an otherwise valid glyph path.
  // Install one shared set of native constructors before PDF.js is imported.
  Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
  const pdfjs=await loadPdfJs();
  const packageRoot=path.join(process.cwd(),"vendor","pdfjs");
  const directoryUrl=(directory:string)=>pathToFileURL(directory+path.sep).href;
  const pdf=await pdfjs.getDocument({
    data:buffer.slice(),
    useWorkerFetch:false,
    isEvalSupported:false,
    useSystemFonts:true,
    standardFontDataUrl:directoryUrl(path.join(packageRoot,"standard_fonts")),
    cMapUrl:directoryUrl(path.join(packageRoot,"cmaps")),
    cMapPacked:true,
  }).promise;
  const output:RenderedPage[]=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
    const page=await pdf.getPage(pageNumber);
    const original=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:dpi/72});
    const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    const context=canvas.getContext("2d");
    await page.render({canvasContext:context as never,viewport}).promise;
    output.push({pageNumber,pdfWidth:original.width,pdfHeight:original.height,pixelWidth:canvas.width,pixelHeight:canvas.height,png:new Uint8Array(await canvas.encode("png"))});
  }
  return output;
}

export async function renderPage(buffer:Uint8Array,pageNumber:number,dpi=200){
  const pages=await renderPages(buffer,dpi);
  const page=pages[pageNumber-1];
  if(!page)throw new Error("PDF page not found");
  return page;
}
