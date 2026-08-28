const API_BASE = "https://api.cloudconvert.com/v2";
const POLL_INTERVAL_MS = 1_250;
const CONVERSION_TIMEOUT_MS = 110_000;

type CloudTask = {
  id: string;
  name: string;
  status: "waiting" | "processing" | "finished" | "error";
  message?: string;
  result?: {
    form?: { url: string; parameters: Record<string, string> };
    files?: Array<{ filename: string; url: string }>;
  };
};
type CloudJob = { id: string; status: string; tasks: CloudTask[] };
type ApiEnvelope<T> = { data: T; message?: string };

function headers(apiKey: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function api<T>(path: string, apiKey: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(apiKey, Boolean(init?.body)), ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || `Conversion provider returned HTTP ${response.status}`);
  }
  return payload.data;
}

function task(job: CloudJob, name: string) {
  return job.tasks.find((item) => item.name === name);
}

export async function convertWordWithCloudConvert(
  bytes: Uint8Array,
  fileName: string,
  inputFormat: string,
  apiKey: string,
): Promise<Uint8Array> {
  const job = await api<CloudJob>("/jobs", apiKey, {
    method: "POST",
    body: JSON.stringify({
      tasks: {
        upload: { operation: "import/upload" },
        convert: {
          operation: "convert",
          input: "upload",
          input_format: inputFormat.replace(/^\./, ""),
          output_format: "docx",
        },
        download: { operation: "export/url", input: "convert", inline: false, archive_multiple_files: false },
      },
    }),
  });

  let upload = task(job, "upload");
  if (!upload?.result?.form) upload = await api<CloudTask>(`/tasks/${upload?.id}`, apiKey);
  const uploadForm = upload?.result?.form;
  if (!uploadForm) throw new Error("Conversion provider did not create an upload target");

  const form = new FormData();
  for (const [key, value] of Object.entries(uploadForm.parameters)) form.append(key, value);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.append("file", new Blob([data]), fileName);
  const uploadResponse = await fetch(uploadForm.url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  if (!uploadResponse.ok) throw new Error(`Conversion provider upload failed with HTTP ${uploadResponse.status}`);

  const deadline = Date.now() + CONVERSION_TIMEOUT_MS;
  let current = job;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    current = await api<CloudJob>(`/jobs/${job.id}`, apiKey);
    const failed = current.tasks.find((item) => item.status === "error");
    if (failed) throw new Error(failed.message || "The conversion provider could not repair this document");
    if (current.status === "finished") break;
  }
  if (current.status !== "finished") throw new Error("The document conversion timed out");

  const exported = task(current, "download")?.result?.files?.[0];
  if (!exported?.url || new URL(exported.url).protocol !== "https:") {
    throw new Error("Conversion provider did not return a secure download URL");
  }
  const result = await fetch(exported.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!result.ok) throw new Error(`Converted document download failed with HTTP ${result.status}`);
  return new Uint8Array(await result.arrayBuffer());
}