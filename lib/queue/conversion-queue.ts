import type { ConversionJob } from "../types";
const root=globalThis as typeof globalThis&{__lipiJobs?:Map<string,ConversionJob>};const jobs=root.__lipiJobs??=new Map();
export function createJob(input:Pick<ConversionJob,"fileName"|"fileSize"|"inputKey">){const now=new Date().toISOString(),job:ConversionJob={id:crypto.randomUUID(),...input,status:"uploaded",progress:0,message:"Upload complete",createdAt:now,updatedAt:now};jobs.set(job.id,job);return job}
export function getJob(id:string){return jobs.get(id)}
export function listJobs(){return [...jobs.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
export function updateJob(id:string,patch:Partial<ConversionJob>){const job=jobs.get(id);if(!job)return;const next={...job,...patch,updatedAt:new Date().toISOString()};jobs.set(id,next);return next}
