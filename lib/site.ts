export const SITE_NAME = "Lipi";
export const SITE_DESCRIPTION =
  "Convert PDF files to editable Word documents, extract text from images in 20 major languages, and repair Word compatibility issues.";

const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
export const SITE_URL = new URL(configuredUrl || "http://localhost:3000");
