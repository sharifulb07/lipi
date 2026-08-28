import { spawn } from "node:child_process";
import { createWorker,OEM } from "tesseract.js";
import type { ConversionLanguage } from "../types";
import { tesseractLanguageFor } from "../conversion-languages";
import type { OcrBlock } from "./layout-analysis";

function parseTsv(output:string):OcrBlock[]{
 const groups=new Map<string,OcrBlock[]>();
 for(const row of output.split(/\r?\n/).slice(1)){
  const columns=row.split("\t");
  if(columns.length<12||columns[0]!=="5")continue;
  const text=columns.slice(11).join("\t").trim(),confidence=Number(columns[10]);
  if(!text||!Number.isFinite(confidence)||confidence<0)continue;
  const block={text,x:Number(columns[6]),y:Number(columns[7]),width:Number(columns[8]),height:Number(columns[9]),confidence};
  const key=columns.slice(1,5).join(":");
  groups.set(key,[...(groups.get(key)??[]),block]);
 }
 return [...groups.values()].map(words=>{
  const ordered=words.sort((a,b)=>a.x-b.x),x=Math.min(...ordered.map(word=>word.x)),y=Math.min(...ordered.map(word=>word.y));
  const right=Math.max(...ordered.map(word=>word.x+word.width)),bottom=Math.max(...ordered.map(word=>word.y+word.height));
  return{text:ordered.map(word=>word.text).join(" "),x,y,width:right-x,height:bottom-y,confidence:ordered.reduce((sum,word)=>sum+word.confidence,0)/ordered.length};
 });
}

function recognizeNative(image:Uint8Array,language:string){
 return new Promise<string>((resolve,reject)=>{
  const process=spawn("tesseract",["stdin","stdout","-l",language,"--psm","3","tsv"],{stdio:["pipe","pipe","pipe"]});
  const stdout:Buffer[]=[],stderr:Buffer[]=[];
  process.stdout.on("data",chunk=>stdout.push(Buffer.from(chunk)));
  process.stderr.on("data",chunk=>stderr.push(Buffer.from(chunk)));
  process.on("error",reject);
  process.on("close",code=>code===0?resolve(Buffer.concat(stdout).toString("utf8")):reject(new Error(Buffer.concat(stderr).toString("utf8").trim()||`Tesseract exited with code ${code}`)));
  process.stdin.end(Buffer.from(image));
 });
}

async function recognizePortable(image:Uint8Array,language:string){
 const worker=await createWorker(language.split("+"),OEM.LSTM_ONLY);
 try{
  const result=await worker.recognize(Buffer.from(image),{}, {tsv:true});
  if(!result.data.tsv)throw new Error("The portable OCR engine returned no text data.");
  return result.data.tsv;
 }finally{await worker.terminate()}
}

export async function recognizePage(image:Uint8Array,language:ConversionLanguage):Promise<OcrBlock[]>{
 const tesseractLanguage=tesseractLanguageFor(language);
 try{return parseTsv(await recognizeNative(image,tesseractLanguage))}
 catch(error){
  const missing=error instanceof Error&&"code" in error&&error.code==="ENOENT";
  if(!missing)throw error;
  try{return parseTsv(await recognizePortable(image,tesseractLanguage))}
  catch(fallbackError){throw new Error(`OCR could not start with either the native or portable engine. ${fallbackError instanceof Error?fallbackError.message:"Language data could not be loaded."}`)}
 }
}
