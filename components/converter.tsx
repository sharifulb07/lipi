"use client";
import { useEffect,useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ConversionJob,ConversionOptions as Options } from "@/lib/types";
import PdfUpload from "./pdf-upload";
import ConversionOptions from "./conversion-options";
import ConversionProgress from "./conversion-progress";
import DownloadCard from "./download-card";

const defaults:Options={language:"auto",mode:"editable",ocr:true};

function upload(file:File,onProgress:(percent:number,speed:number)=>void){
 return new Promise<ConversionJob>((resolve,reject)=>{
  const request=new XMLHttpRequest(),form=new FormData(),started=Date.now();
  form.append("file",file);
  request.open("POST","/api/upload");
  request.upload.onprogress=event=>{
   if(!event.lengthComputable)return;
   const seconds=Math.max((Date.now()-started)/1000,.1);
   onProgress(Math.round(event.loaded/event.total*100),event.loaded/seconds);
  };
  request.onerror=()=>reject(new Error("Upload failed. Check your connection and try again."));
  request.onabort=()=>reject(new Error("The upload was cancelled."));
  request.ontimeout=()=>reject(new Error("The upload timed out. Please try again."));
  request.timeout=120000;
  request.onload=()=>{
   let data:{job?:ConversionJob;error?:string}|null=null;
   try{data=JSON.parse(request.responseText) as {job?:ConversionJob;error?:string}}catch{
    const fallback=request.status===413?"The PDF is too large for the upload server.":request.status>=500?"The upload server could not process the PDF. Please try again.":`Upload failed (HTTP ${request.status||"unknown"}).`;
    reject(new Error(fallback));return;
   }
   if(request.status<200||request.status>=300||!data.job){reject(new Error(data.error||`Upload failed (HTTP ${request.status}).`));return}
   resolve(data.job);
  };
  request.send(form);
 });
}

export default function Converter(){
 const[file,setFile]=useState<File|null>(null),[options,setOptions]=useState(defaults),[job,setJob]=useState<ConversionJob|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[uploadState,setUploadState]=useState<{percent:number;speed:number}|null>(null);
 useEffect(()=>{if(!job||["completed","failed"].includes(job.status))return;const timer=setInterval(async()=>{const response=await fetch(`/api/status/${job.id}`);if(response.ok){const data=await response.json();setJob(data.job);if(data.job.status==="completed"){setBusy(false);const saved=JSON.parse(localStorage.getItem("lipi-history")??"[]");localStorage.setItem("lipi-history",JSON.stringify([data.job,...saved.filter((x:ConversionJob)=>x.id!==data.job.id)].slice(0,20)))}}},750);return()=>clearInterval(timer)},[job]);
 function reset(){setFile(null);setJob(null);setError("");setBusy(false);setUploadState(null)}
 function choose(next:File|null){setError("");if(next&&(next.size>20*1024*1024||(!next.name.toLowerCase().endsWith(".pdf")&&next.type!=="application/pdf"))){setError("Choose a PDF no larger than 20 MB.");return}setFile(next)}
 async function convert(){
  if(!file)return;
  setBusy(true);setError("");setUploadState({percent:0,speed:0});
  try{
   const uploadedJob=await upload(file,(percent,speed)=>setUploadState({percent,speed}));
   setJob(uploadedJob);setUploadState(null);
   const response=await fetch("/api/convert",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jobId:uploadedJob.id,options})});
   if(!response.ok){const data=await response.json();throw new Error(data.error)}
  }catch(e){setError(e instanceof Error?e.message:"Conversion failed");setBusy(false);setUploadState(null)}
 }
 const working=busy&&(!job||job.status!=="completed"&&job.status!=="failed");
 return <div className="converter-card"><div className="card-top"><div><span className="step">01</span><strong>Choose your document</strong></div><span className="secure">Secure and private</span></div>{job?.status==="completed"?<DownloadCard job={job} onReset={reset}/>:<><PdfUpload file={file} onChange={choose} disabled={working}/><ConversionOptions value={options} onChange={setOptions} disabled={working}/>{uploadState&&<div className="progress upload-progress"><div><span>Uploading PDF · {(uploadState.speed/1048576).toFixed(1)} MB/s</span><b>{uploadState.percent}%</b></div><div className="track"><i style={{width:`${uploadState.percent}%`}}/></div></div>}{job&&working&&<ConversionProgress job={job}/>} {(error||job?.error)&&<div className="notice error">{error||job?.error}</div>}<button className="convert-button" disabled={!file||working} onClick={job?.status==="failed"?reset:convert}>{working?<><RefreshCw className="spin"/> {uploadState?"Uploading...":"Converting..."}</>:job?.status==="failed"?"Try another PDF":<>Convert to Word <span>-&gt;</span></>}</button><p className="helper">Files are automatically cleaned from local storage. Maximum 20 MB.</p></>}</div>;
}
