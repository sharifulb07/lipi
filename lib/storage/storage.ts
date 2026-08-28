import { mkdir,readFile,writeFile } from "node:fs/promises"; import path from "node:path";
const ROOT=path.join(process.cwd(),".data"); function safe(key:string){if(!/^[a-zA-Z0-9._/-]+$/.test(key)||key.includes(".."))throw new Error("Invalid storage key");return path.join(ROOT,key)}
export async function putObject(key:string,data:Uint8Array){const file=safe(key);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,data);return key}
export async function getObject(key:string){return new Uint8Array(await readFile(safe(key)))}
