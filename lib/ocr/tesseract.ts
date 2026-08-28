import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createWorker,OEM } from "tesseract.js";
import type { ConversionLanguage } from "../types";
import { tesseractLanguageFor } from "../conversion-languages";
import type { OcrBlock } from "./layout-analysis";

type PortableWorker = Awaited<ReturnType<typeof createWorker>>;
type WorkerEntry = { worker: Promise<PortableWorker>; queue: Promise<void>; uses: number; lastUsed: number };
type OcrGlobals = typeof globalThis & {
  __lipiOcrWorkers?: Map<string, WorkerEntry>;
  __lipiNativeTesseractMissing?: boolean;
};
const runtime = globalThis as OcrGlobals;
const workers = (runtime.__lipiOcrWorkers ??= new Map());
const MAX_CACHED_WORKERS = 3;
const MAX_WORKER_USES = 75;

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

function recognizeNative(image:Uint8Array,language:string,tsv=true){
 return new Promise<string>((resolve,reject)=>{
  const args=["stdin","stdout","-l",language,"--psm","3",...(tsv?["tsv"]:[])];
  const process=spawn("tesseract",args,{stdio:["pipe","pipe","pipe"]});
  const stdout:Buffer[]=[],stderr:Buffer[]=[];
  process.stdout.on("data",chunk=>stdout.push(Buffer.from(chunk)));
  process.stderr.on("data",chunk=>stderr.push(Buffer.from(chunk)));
  process.on("error",reject);
  process.on("close",code=>code===0?resolve(Buffer.concat(stdout).toString("utf8")):reject(new Error(Buffer.concat(stderr).toString("utf8").trim()||`Tesseract exited with code ${code}`)));
  process.stdin.end(Buffer.from(image));
 });
}

async function createPortableWorker(language:string){
 const cachePath=path.join(os.tmpdir(),"lipi-tesseract-cache");
 await mkdir(cachePath,{recursive:true});
 return createWorker(language.split("+"),OEM.LSTM_ONLY,{
  cachePath,
  langPath:process.env.TESSERACT_LANG_PATH?.trim()||"https://tessdata.projectnaptha.com/4.0.0_fast",
 });
}

async function evictIdleWorkers(except:string){
 if(workers.size<MAX_CACHED_WORKERS)return;
 const candidate=[...workers.entries()].filter(([language])=>language!==except).sort((a,b)=>a[1].lastUsed-b[1].lastUsed)[0];
 if(!candidate)return;
 workers.delete(candidate[0]);
 await candidate[1].queue.finally(async()=>{const worker=await candidate[1].worker.catch(()=>null);await worker?.terminate().catch(()=>undefined)});
}

async function recognizePortable(image:Uint8Array,language:string,format:"tsv"|"text"="tsv"){
 let entry=workers.get(language);
 if(!entry){
  await evictIdleWorkers(language);
  entry={worker:createPortableWorker(language),queue:Promise.resolve(),uses:0,lastUsed:Date.now()};
  workers.set(language,entry);
 }
 const selected=entry;
 const recognition=selected.queue.then(async()=>{
  const worker=await selected.worker;
  const result=await worker.recognize(Buffer.from(image),{},format==="tsv"?{tsv:true}:{text:true});
  const value=format==="tsv"?result.data.tsv:result.data.text;
  if(!value)throw new Error("The portable OCR engine returned no text data.");
  return value;
 });
 selected.queue=recognition.then(()=>undefined,()=>undefined);
 selected.uses+=1;selected.lastUsed=Date.now();
 try{return await recognition}
 catch(error){
  workers.delete(language);
  const worker=await selected.worker.catch(()=>null);await worker?.terminate().catch(()=>undefined);
  throw error;
 }finally{
  if(selected.uses>=MAX_WORKER_USES&&workers.get(language)===selected){
   workers.delete(language);
   void selected.queue.finally(async()=>{const worker=await selected.worker.catch(()=>null);await worker?.terminate().catch(()=>undefined)});
  }
 }
}

export async function discardOcrWorker(language:ConversionLanguage){
 const key=tesseractLanguageFor(language),entry=workers.get(key);
 if(!entry)return;
 workers.delete(key);
 const worker=await entry.worker.catch(()=>null);
 await worker?.terminate().catch(()=>undefined);
}
export async function recognizeText(image:Uint8Array,language:ConversionLanguage):Promise<string>{
 const tesseractLanguage=tesseractLanguageFor(language);
 if(!runtime.__lipiNativeTesseractMissing){
  try{return (await recognizeNative(image,tesseractLanguage,false)).trim()}
  catch(error){
   const missing=error instanceof Error&&"code" in error&&error.code==="ENOENT";
   if(!missing)throw error;
   runtime.__lipiNativeTesseractMissing=true;
  }
 }
 try{return (await recognizePortable(image,tesseractLanguage,"text")).trim()}
 catch(error){throw new Error(`OCR could not start. ${error instanceof Error?error.message:"Language data could not be loaded."}`)}
}
export async function recognizePage(image:Uint8Array,language:ConversionLanguage):Promise<OcrBlock[]>{
 const tesseractLanguage=tesseractLanguageFor(language);
 if(!runtime.__lipiNativeTesseractMissing){
  try{return parseTsv(await recognizeNative(image,tesseractLanguage))}
  catch(error){
   const missing=error instanceof Error&&"code" in error&&error.code==="ENOENT";
   if(!missing)throw error;
   runtime.__lipiNativeTesseractMissing=true;
  }
 }
 try{return parseTsv(await recognizePortable(image,tesseractLanguage))}
 catch(error){throw new Error(`OCR could not start. ${error instanceof Error?error.message:"Language data could not be loaded."}`)}
}