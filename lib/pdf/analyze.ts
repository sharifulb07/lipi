import { countBanglaCharacters } from "../bangla/normalize";
import type { ExtractedPage, PdfAnalysis } from "../types";
import { detectPdfType } from "./detect-pdf-type";
import { extractText } from "./extract-text";

export function analyzeExtractedPdf(pages: ExtractedPage[], fonts: string[]): PdfAnalysis {
  const text = pages.flatMap((page) => [
    ...page.lines.map((line) => line.text),
    ...page.tables.flatMap((table) => table.rows.flatMap((row) => row.map((cell) => cell.text))),
  ]).join("");
  const kind = detectPdfType(pages, fonts);
  return { kind, pages: pages.length, textCharacters: text.length,
    banglaCharacters: countBanglaCharacters(text), fonts,
    confidence: kind === "unicode" ? .98 : kind === "mixed" ? .8 : kind === "legacy" ? .62 : 0 };
}

export async function analyzePdf(buffer: Uint8Array): Promise<PdfAnalysis> {
  const { pages, fonts } = await extractText(buffer);
  return analyzeExtractedPdf(pages, fonts);
}
