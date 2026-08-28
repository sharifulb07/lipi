import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lipi PDF to Word Converter",
    short_name: "Lipi",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f3",
    theme_color: "#123e39",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
