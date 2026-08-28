import { createCanvas, loadImage } from "@napi-rs/canvas";

export interface PreprocessOptions {
  maxDimension?: number;
  maxPixels?: number;
}

export async function preprocess(image: Uint8Array, options: PreprocessOptions = {}): Promise<Uint8Array> {
  const source = await loadImage(Buffer.from(image));
  const maxDimension = options.maxDimension ?? 2400;
  const maxPixels = options.maxPixels ?? 5_000_000;
  const dimensionScale = maxDimension / Math.max(source.width, source.height);
  const pixelScale = Math.sqrt(maxPixels / Math.max(1, source.width * source.height));
  const scale = Math.min(1, dimensionScale, pixelScale);
  if (scale >= 0.995) return image;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return new Uint8Array(await canvas.encode("jpeg", 88));
}