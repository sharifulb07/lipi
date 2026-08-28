import { NextResponse } from "next/server";
import { isConversionLanguage } from "@/lib/conversion-languages";
import { recognizePage } from "@/lib/ocr/tesseract";
import { isSupportedImage, requestGuard } from "@/lib/security/request";
export const runtime = "nodejs";
const accepted = new Set(["image/png","image/jpeg","image/tiff","image/bmp","image/webp"]);

export async function POST(request: Request) {
  try {
    const blocked = requestGuard(request, "image-ocr", { maxRequests: 10, maxMegabytes: 21 });
    if (blocked) return blocked;
    const form = await request.formData(), file = form.get("file"), language = form.get("language");
    if (!(file instanceof File)) return NextResponse.json({ error: "An image file is required" }, { status: 400 });
    if (file.size > 20*1024*1024) return NextResponse.json({ error: "Maximum file size is 20 MB" }, { status: 413 });
    if (!accepted.has(file.type)) return NextResponse.json({ error: "Use a PNG, JPG, TIFF, BMP, or WebP image" }, { status: 415 });
    if (!isConversionLanguage(language)) return NextResponse.json({ error: "Choose a supported OCR language" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isSupportedImage(bytes)) return NextResponse.json({ error: "The file content does not match a supported image format" }, { status: 415 });
    const blocks = await recognizePage(bytes, language);
    return NextResponse.json({ text: blocks.map((block) => block.text).join("\n"), blocks: blocks.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Image OCR failed", error);
    return NextResponse.json({ error: "Image OCR failed. Verify the OCR language data and try again." }, { status: 500 });
  }
}
