const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;

function endpointFor(value: string) {
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("The open-source Word conversion service must use HTTPS in production");
  }
  if (!url.pathname.includes("/convert-to/")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/cool/convert-to/docx`;
  }
  return url;
}

export async function convertWordWithOpenSourceService(
  bytes: Uint8Array,
  fileName: string,
  serviceUrl: string,
  token?: string,
): Promise<Uint8Array> {
  const endpoint = endpointFor(serviceUrl);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const form = new FormData();
  // Collabora Online's open-source conversion endpoint accepts the source as
  // the `data` multipart field and takes the output format from the URL.
  form.append("data", new Blob([data]), fileName);
  form.append("format", "docx");

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(110_000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error(detail || `Open-source conversion service returned HTTP ${response.status}`);
  }
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_OUTPUT_BYTES) {
    throw new Error("The converted document exceeds the 50 MB output limit");
  }
  const output = new Uint8Array(await response.arrayBuffer());
  if (output.length > MAX_OUTPUT_BYTES) throw new Error("The converted document exceeds the 50 MB output limit");
  if (output[0] !== 0x50 || output[1] !== 0x4b) {
    throw new Error("The open-source service did not return a valid DOCX file");
  }
  return output;
}