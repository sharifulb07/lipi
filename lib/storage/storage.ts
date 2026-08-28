import os from "node:os";
import path from "node:path";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

const configuredRoot = process.env.LIPI_STORAGE_DIR?.trim();
const ROOT = path.resolve(/* turbopackIgnore: true */ 
  configuredRoot ||
    (process.env.NODE_ENV === "production"
      ? path.join(os.tmpdir(), "lipi-converter")
      : path.join(process.cwd(), ".data")),
);

function safe(key: string) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) {
    throw new Error("Invalid storage key");
  }
  const file = path.resolve(ROOT, key);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error("Invalid storage key");
  }
  return file;
}

export async function putObject(key: string, data: Uint8Array) {
  const file = safe(key);
  const directory = path.dirname(file);
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporary, data, { flag: "wx" });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return key;
}

export async function getObject(key: string) {
  return new Uint8Array(await readFile(safe(key)));
}