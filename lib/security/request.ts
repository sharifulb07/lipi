type LimitEntry = { count: number; resetAt: number };
const globalStore = globalThis as typeof globalThis & {
  __lipiRateLimits?: Map<string, LimitEntry>;
};
const limits = (globalStore.__lipiRateLimits ??= new Map());

export function requestGuard(
  request: Request,
  bucket: string,
  options: { maxRequests?: number; maxMegabytes?: number } = {},
): Response | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Cross-site requests are not allowed" }, { status: 403 });
  }
  const maxBytes = (options.maxMegabytes ?? 21) * 1024 * 1024;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return Response.json({ error: "Request is too large" }, { status: 413 });
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwarded || request.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${client}`;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  let entry = limits.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    limits.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > (options.maxRequests ?? 20)) {
    return Response.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } },
    );
  }
  if (limits.size > 2_000) {
    for (const [storedKey, stored] of limits) if (stored.resetAt <= now) limits.delete(storedKey);
  }
  return null;
}

export function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5 && new TextDecoder("ascii").decode(bytes.subarray(0, 5)) === "%PDF-";
}

export function isSupportedImage(bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  return starts(0x89,0x50,0x4e,0x47) || starts(0xff,0xd8,0xff) ||
    starts(0x49,0x49,0x2a,0x00) || starts(0x4d,0x4d,0x00,0x2a) ||
    starts(0x42,0x4d) || (starts(0x52,0x49,0x46,0x46) && bytes.length >= 12 &&
    new TextDecoder("ascii").decode(bytes.subarray(8,12)) === "WEBP");
}

export function matchesDocumentType(bytes: Uint8Array, extension: string) {
  const starts = (...values: number[]) => values.every((value,index) => bytes[index] === value);
  if (extension === ".doc") return starts(0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1);
  if (extension === ".rtf") return new TextDecoder("ascii").decode(bytes.subarray(0,5)) === "{\\rtf";
  return [".docx",".odt"].includes(extension) && starts(0x50,0x4b);
}
