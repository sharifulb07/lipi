import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Inter } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});
const bangla = Hind_Siliguri({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-bangla",
});

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: "PDF to Word Converter & Image OCR | Lipi",
    template: "%s | Lipi",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  icons:{
    icon:"/public/icon.svg"
  },
  keywords: [
    "PDF to Word converter",
    "editable Word",
    "image to text",
    "multilingual OCR",
    "Word compatibility",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: "PDF to Word Converter & Image OCR | Lipi",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF to Word Converter & Image OCR | Lipi",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "productivity",
};
export const viewport: Viewport = {
  themeColor: "#123e39",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${bangla.variable}`}>{children}</body>
    </html>
  );
}
