import path from "node:path";
import { pathToFileURL } from "node:url";

let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | undefined;

export async function loadPdfJs() {
  const pdfjs = await (pdfJsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs"));
  // PDF.js uses a same-thread fake worker in Node. Keep that worker in a
  // project-owned traced asset so serverless deployments never depend on a
  // dynamically resolved node_modules path.
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.join(process.cwd(), "vendor", "pdfjs", "pdf.worker.mjs"),
  ).href;
  return pdfjs;
}