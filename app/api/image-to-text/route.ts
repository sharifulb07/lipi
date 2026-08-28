import { NextResponse } from "next/server";
import { isConversionLanguage } from "@/lib/conversion-languages";
import { preprocess } from "@/lib/ocr/preprocess";
import { discardOcrWorker, recognizeText } from "@/lib/ocr/tesseract";
import { isSupportedImage, requestGuard } from "@/lib/security/request";
import type { ConversionLanguage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;
const accepted = new Set(["image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp"]);

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("OCR timed out")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let selectedLanguage: ConversionLanguage | undefined;
  try {
    const blocked = requestGuard(request, "image-ocr", { maxRequests: 10, maxMegabytes: 21 });
    if (blocked) return blocked;
    const form = await request.formData();
    const file = form.get("file"), language = form.get("language");
    if (!(file instanceof File)) return NextResponse.json({ error: "An image file is required" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Maximum file size is 20 MB" }, { status: 413 });
    if (!accepted.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, TIFF, BMP, or WebP image" }, { status: 415 });
    if (!isConversionLanguage(language)) return NextResponse.json({ error: "Choose a supported OCR language" }, { status: 400 });
    selectedLanguage=language;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isSupportedImage(bytes)) return NextResponse.json({ error: "The file content does not match a supported image format" }, { status: 415 });
    const optimized = await preprocess(bytes, { maxDimension: 1800, maxPixels: 3_000_000 });
    const text = await withTimeout(recognizeText(optimized, selectedLanguage), 50_000);
    return NextResponse.json(
      { text, blocks: text ? text.split(/\r?\n/).filter(Boolean).length : 0 },
      { headers: { "Cache-Control": "no-store", "Server-Timing": "ocr;desc=optimized" } },
    );
  } catch (error) {
    console.error("Image OCR failed", error);
    const timedOut = error instanceof Error && error.message === "OCR timed out";
    if(timedOut && selectedLanguage) await discardOcrWorker(selectedLanguage);
    return NextResponse.json(
      { error: timedOut ? "Text extraction timed out. Try a smaller image." : "Image OCR failed. Verify the OCR language data and try again." },
      { status: timedOut ? 504 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}