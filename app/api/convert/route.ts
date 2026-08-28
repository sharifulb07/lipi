import { NextResponse } from "next/server";
import { isConversionLanguage } from "@/lib/conversion-languages";
import type { ConversionMode,ConversionOptions } from "@/lib/types";
import { getJob,updateJob } from "@/lib/queue/conversion-queue";
import { processConversion } from "@/workers/pdf-converter.worker";
import { requestGuard } from "@/lib/security/request";
export const runtime="nodejs";
const modes:readonly ConversionMode[]=["editable","fixed-layout","preserve-layout"];
function isMode(value:unknown):value is ConversionMode{return typeof value==="string"&&modes.includes(value as ConversionMode)}
export async function POST(request:Request){
 const blocked=requestGuard(request,"pdf-convert",{maxRequests:20,maxMegabytes:1});if(blocked)return blocked;
 const body=await request.json() as {jobId?:string;options?:Partial<ConversionOptions>};
 if(!body.jobId||!getJob(body.jobId))return NextResponse.json({error:"Job not found"},{status:404});
 if(!body.options||!isConversionLanguage(body.options.language)||!isMode(body.options.mode)||typeof body.options.ocr!=="boolean")return NextResponse.json({error:"Invalid conversion options"},{status:400});
 const options:ConversionOptions={language:body.options.language,mode:body.options.mode,ocr:body.options.ocr};
 updateJob(body.jobId,{status:"queued",progress:5,message:"Queued",options,error:undefined,outputKey:undefined});
 void processConversion(body.jobId);
 return NextResponse.json({jobId:body.jobId,status:"queued"},{status:202});
}
