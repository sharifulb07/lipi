import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { matchesDocumentType, requestGuard } from "@/lib/security/request";
export const runtime = "nodejs";
const run = promisify(execFile), extensions = new Set([".doc",".docx",".odt",".rtf"]);

function officeExecutable() {
  const candidates = process.platform === "win32"
    ? [process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES,"LibreOffice","program","soffice.exe"), process.env["PROGRAMFILES(X86)"] && path.join(process.env["PROGRAMFILES(X86)"],"LibreOffice","program","soffice.exe")]
    : ["/usr/bin/soffice","/usr/local/bin/soffice"];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? "soffice";
}
function downloadName(name: string) {
  const base = path.basename(name,path.extname(name)).replace(/[^a-zA-Z0-9._ -]/g,"_") || "document";
  return `${base}-compatible.docx`;
}
export async function POST(request: Request) {
  let temporary = "";
  try {
    const blocked = requestGuard(request, "word-fix", { maxRequests: 10, maxMegabytes: 21 });
    if (blocked) return blocked;
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "A Word document is required" }, { status: 400 });
    if (file.size > 20*1024*1024) return NextResponse.json({ error: "Maximum file size is 20 MB" }, { status: 413 });
    const extension = path.extname(file.name).toLowerCase();
    if (!extensions.has(extension)) return NextResponse.json({ error: "Use a DOC, DOCX, ODT, or RTF file" }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesDocumentType(bytes, extension)) return NextResponse.json({ error: "The file content does not match its document extension" }, { status: 415 });
    temporary = await mkdtemp(path.join(os.tmpdir(),"lipi-word-"));
    const inputDirectory=path.join(temporary,"input"), outputDirectory=path.join(temporary,"output"), profileDirectory=path.join(temporary,"profile");
    await mkdir(inputDirectory); await mkdir(outputDirectory); await mkdir(profileDirectory);
    const inputPath=path.join(inputDirectory,`document${extension}`);
    await writeFile(inputPath,bytes);
    try {
      await run(officeExecutable(),[
        "--headless","--nologo","--nodefault","--norestore","--nolockcheck",
        `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
        "--convert-to","docx","--outdir",outputDirectory,inputPath,
      ],{timeout:120000,windowsHide:true,maxBuffer:1024*1024});
    } catch(error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        throw new Error("Word compatibility service is not installed. Install LibreOffice Writer on this worker.");
      console.error("Word compatibility conversion failed", error);
      throw new Error("The document could not be repaired. It may be damaged or unsupported.");
    }
    const output=(await readdir(outputDirectory)).find((name)=>name.toLowerCase().endsWith(".docx"));
    if(!output) throw new Error("The document could not be converted to a modern Word file.");
    const result=await readFile(path.join(outputDirectory,output));
    return new Response(result,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":`attachment; filename="${downloadName(file.name)}"`,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Document repair failed"},{status:500});
  } finally {
    if(temporary) await rm(temporary,{recursive:true,force:true}).catch(()=>undefined);
  }
}
