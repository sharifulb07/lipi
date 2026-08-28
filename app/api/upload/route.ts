import { NextResponse } from "next/server";
import { createJob } from "@/lib/queue/conversion-queue";
import { isPdf, requestGuard } from "@/lib/security/request";
import { putObject } from "@/lib/storage/storage";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const blocked = requestGuard(request, "pdf-upload", { maxRequests: 15, maxMegabytes: 21 });
  if (blocked) return blocked;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Maximum file size is 20 MB" }, { status: 413 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return NextResponse.json({ error: "The uploaded file is not a valid PDF" }, { status: 415 });
  const key = `uploads/${crypto.randomUUID()}.pdf`;
  await putObject(key, bytes);
  return NextResponse.json({ job: createJob({ fileName: file.name, fileSize: file.size, inputKey: key }) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
