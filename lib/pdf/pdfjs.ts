type WorkerMessageHandler = {
  setup: (handler: unknown, port: unknown) => void;
};

type PdfJsGlobal = typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: WorkerMessageHandler };
};

let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | undefined;

export async function loadPdfJs() {
  const runtime = globalThis as PdfJsGlobal;
  if (!runtime.pdfjsWorker) {
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    runtime.pdfjsWorker = { WorkerMessageHandler: worker.WorkerMessageHandler };
  }
  return (pdfJsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs"));
}