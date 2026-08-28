"use client";
import { useRef,useState } from "react";
import { Clipboard,Download,ImageIcon,LoaderCircle,Upload } from "lucide-react";
import { CONVERSION_LANGUAGES } from "@/lib/conversion-languages";
import type { ConversionLanguage } from "@/lib/types";

type OcrResponse={text?:string;error?:string};
async function readOcrResponse(response:Response):Promise<OcrResponse>{
 const raw=await response.text();
 try{return JSON.parse(raw) as OcrResponse}catch{
  const clean=raw.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
  if(response.status===413)return{error:"The image is too large for the server."};
  if(response.status===504||/timeout|timed out/i.test(clean))return{error:"Text extraction timed out. Try a smaller or clearer image."};
  return{error:clean.slice(0,180)||`The OCR server returned HTTP ${response.status}.`};
 }
}

export default function ImageToText(){
 const input=useRef<HTMLInputElement>(null),[file,setFile]=useState<File|null>(null),[language,setLanguage]=useState<ConversionLanguage>("eng"),[text,setText]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function extract(){if(!file)return;setBusy(true);setError("");setText("");const form=new FormData();form.append("file",file);form.append("language",language);try{const response=await fetch("/api/image-to-text",{method:"POST",body:form}),data=await readOcrResponse(response);if(!response.ok)throw new Error(data.error||"Text extraction failed");setText(data.text||"No text was found in this image.")}catch(reason){setError(reason instanceof Error?reason.message:"Text extraction failed")}finally{setBusy(false)}}
 function download(){const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"})),link=document.createElement("a");link.href=url;link.download=`${file?.name.replace(/\.[^.]+$/,"")||"extracted"}-text.txt`;link.click();URL.revokeObjectURL(url)}
 return <section className="tool-card" id="image-to-text"><div className="tool-heading"><span className="tool-icon mint"><ImageIcon/></span><div><span className="eyebrow">IMAGE TO TEXT</span><h2>Extract editable text from images</h2><p>Upload a scan or photo and recognize text in any of the 20 supported languages.</p></div></div><div className="tool-grid"><label className="mini-upload" onClick={()=>input.current?.click()}><Upload/><strong>{file?file.name:"Choose an image"}</strong><span>PNG, JPG, TIFF, BMP, or WebP - up to 20 MB</span><input ref={input} type="file" accept="image/png,image/jpeg,image/tiff,image/bmp,image/webp" hidden onChange={event=>{setFile(event.target.files?.[0]??null);setText("");setError("")}}/></label><div className="tool-controls"><label><span>Text language</span><select value={language} onChange={event=>setLanguage(event.target.value as ConversionLanguage)}>{CONVERSION_LANGUAGES.filter(item=>item.value!=="ben+eng").map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="convert-button" disabled={!file||busy} onClick={extract}>{busy?<><LoaderCircle className="spin"/>Extracting...</>:<>Extract text</>}</button>{busy&&<small>The first request for a language loads its OCR model. Later images are faster.</small>}</div></div>{error&&<div className="notice error">{error}</div>}{text&&<div className="text-result"><textarea value={text} onChange={event=>setText(event.target.value)} aria-label="Extracted text"/><div><button onClick={()=>navigator.clipboard.writeText(text)}><Clipboard/> Copy</button><button onClick={download}><Download/> Download TXT</button></div></div>}</section>
}