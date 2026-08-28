import { NextResponse } from "next/server";
import { createJob } from "@/lib/queue/conversion-queue";
import { isPdf, requestGuard } from "@/lib/security/request";
import { putObject } from "@/lib/storage/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const blocked = requestGuard(request, "pdf-upload", {
      maxRequests: 15,
      maxMegabytes: 21,
    });
    if (blocked) return blocked;

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("A PDF file is required", 400);
    if (file.size === 0) return jsonError("The selected PDF is empty", 400);
    if (file.size > 20 * 1024 * 1024) return jsonError("Maximum file size is 20 MB", 413);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return jsonError("Only PDF files are accepted", 415);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(bytes)) return jsonError("The uploaded file is not a valid PDF", 415);

    const key = `uploads/${crypto.randomUUID()}.pdf`;
    await putObject(key, bytes);
    const job = createJob({ fileName: file.name, fileSize: file.size, inputKey: key });
    return NextResponse.json(
      { job },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("PDF upload failed", error);
    if (error instanceof TypeError) {
      return jsonError("The upload body could not be read. Please select the PDF again.", 400);
    }
    return jsonError("The upload could not be stored. Please try again.", 500);
  }
}