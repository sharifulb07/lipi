import { NextResponse } from "next/server";import { getJob } from "@/lib/queue/conversion-queue";
export async function GET(_request:Request,{params}:{params:Promise<{jobId:string}>}){const{jobId}=await params,job=getJob(jobId);return job?NextResponse.json({job}):NextResponse.json({error:"Job not found"},{status:404})}
