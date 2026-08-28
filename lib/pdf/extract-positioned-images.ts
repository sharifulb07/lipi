import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas,DOMMatrix,ImageData,Path2D } from "@napi-rs/canvas";
import { loadPdfJs } from "./pdfjs";

export interface PositionedPdfImage {pageNumber:number;x:number;top:number;width:number;height:number;rotation:number;flipHorizontal:boolean;flipVertical:boolean;data:Uint8Array}
type Matrix=[number,number,number,number,number,number];
type PdfImageData={width:number;height:number;kind?:number;data?:ArrayLike<number>;bitmap?:unknown};
function multiply(left:Matrix,right:Matrix):Matrix{return[
 left[0]*right[0]+left[2]*right[1],left[1]*right[0]+left[3]*right[1],
 left[0]*right[2]+left[2]*right[3],left[1]*right[2]+left[3]*right[3],
 left[0]*right[4]+left[2]*right[5]+left[4],left[1]*right[4]+left[3]*right[5]+left[5],
]}
function point(matrix:Matrix,x:number,y:number){return{x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]}}
function pageObject(page:{objs:{get:(id:string,callback:(data:PdfImageData)=>void)=>unknown}},id:string){return new Promise<PdfImageData>(resolve=>page.objs.get(id,resolve))}
async function imagePng(image:PdfImageData){
 const canvas=createCanvas(image.width,image.height),context=canvas.getContext("2d");
 if(image.bitmap){context.drawImage(image.bitmap as never,0,0,image.width,image.height)}
 else if(image.data){
  const source=image.data,rgba=new Uint8ClampedArray(image.width*image.height*4);
  if(image.kind===3)rgba.set(source);
  else if(image.kind===2)for(let input=0,output=0;output<rgba.length;input+=3,output+=4){rgba[output]=source[input];rgba[output+1]=source[input+1];rgba[output+2]=source[input+2];rgba[output+3]=255}
  else for(let pixel=0;pixel<image.width*image.height;pixel++){const value=(source[pixel>>3]&(128>>(pixel&7)))?0:255,output=pixel*4;rgba[output]=value;rgba[output+1]=value;rgba[output+2]=value;rgba[output+3]=255}
  context.putImageData(new ImageData(rgba,image.width,image.height),0,0);
 }else return null;
 return new Uint8Array(await canvas.encode("png"));
}

export async function extractPositionedImages(buffer:Uint8Array):Promise<PositionedPdfImage[]>{
 Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
 const pdfjs=await loadPdfJs();
 const packageRoot=path.join(process.cwd(),"node_modules","pdfjs-dist"),directoryUrl=(directory:string)=>pathToFileURL(directory+path.sep).href;
 const pdf=await pdfjs.getDocument({data:buffer.slice(),useWorkerFetch:false,isEvalSupported:false,useSystemFonts:true,standardFontDataUrl:directoryUrl(path.join(packageRoot,"standard_fonts")),cMapUrl:directoryUrl(path.join(packageRoot,"cmaps")),cMapPacked:true}).promise;
 const output:PositionedPdfImage[]=[];
 for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
  const page=await pdf.getPage(pageNumber),viewport=page.getViewport({scale:1}),operatorList=await page.getOperatorList(),stack:Matrix[]=[];
  let matrix:Matrix=[1,0,0,1,0,0];
  for(let index=0;index<operatorList.fnArray.length;index++){
   const operation=operatorList.fnArray[index],args=operatorList.argsArray[index] as unknown[];
   if(operation===pdfjs.OPS.save){stack.push([...matrix] as Matrix);continue}
   if(operation===pdfjs.OPS.restore){matrix=stack.pop()??[1,0,0,1,0,0];continue}
   if(operation===pdfjs.OPS.transform&&args.length>=6){matrix=multiply(matrix,args.slice(0,6).map(Number) as Matrix);continue}
   let image:PdfImageData|undefined;
   if(operation===pdfjs.OPS.paintImageXObject&&typeof args[0]==="string")image=await pageObject(page as never,args[0]);
   else if(operation===pdfjs.OPS.paintInlineImageXObject)image=args[0] as PdfImageData;
   else continue;
   if(!image?.width||!image.height)continue;
   const data=await imagePng(image);if(!data)continue;
   const corners=[point(matrix,0,0),point(matrix,1,0),point(matrix,0,1),point(matrix,1,1)];
   const left=Math.min(...corners.map(corner=>corner.x)),topY=Math.max(...corners.map(corner=>corner.y));
   const width=Math.hypot(matrix[0],matrix[1]),height=Math.hypot(matrix[2],matrix[3]);
   if(width<.5||height<.5)continue;
   output.push({pageNumber,x:Math.max(0,left),top:Math.max(0,viewport.height-topY),width,height,rotation:Math.atan2(matrix[1],matrix[0])*180/Math.PI,flipHorizontal:matrix[0]<0,flipVertical:matrix[3]<0,data});
  }
 }
 await pdf.destroy();
 return output;
}
