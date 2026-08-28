import Link from "next/link";
import Converter from "@/components/converter";
import ImageToText from "@/components/image-to-text";
import WordCompatibilityFixer from "@/components/word-compatibility-fixer";
import { FileText, Languages, LockKeyhole } from "lucide-react";
import { CONVERSION_LANGUAGES } from "@/lib/conversion-languages";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

const languageNames = CONVERSION_LANGUAGES.filter(({ value }) => !["auto", "ben+eng"].includes(value)).map(({ label }) => label);
const structuredData = {
  "@context": "https://schema.org", "@type": "WebApplication",
  name: "Lipi PDF to Word Converter", url: SITE_URL.toString(), description: SITE_DESCRIPTION,
  applicationCategory: "BusinessApplication", operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: ["Editable PDF to Word conversion", "Image OCR in 20 major languages", "Word compatibility repair"],
};

export default function Home() {
  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <nav className="nav shell" aria-label="Main navigation">
      <Link className="brand" href="/" aria-label="Lipi home"><span className="brand-mark">Li</span><span>Lipi</span></Link>
      <div className="nav-links"><a href="#tools">More tools</a><a href="#how">How it works</a><a href="#privacy">Privacy</a></div>
    </nav>
    <section className="hero shell">
      <h1>Your PDF, now <em>beautifully editable.</em></h1>
      <p>Turn PDFs in 20 major languages into clean, editable Word documents with OCR, Unicode text, and preserved structure.</p>
      <Converter />
      <div className="trust"><span><LockKeyhole size={15}/> Secure worker processing</span><i/><span>No sign-up required</span><i/><span>Free for documents up to 20 MB</span></div>
    </section>
    <section className="tools-section shell" id="tools">
      <div className="tools-intro"><span className="eyebrow">MORE DOCUMENT TOOLS</span><h2>Extract, repair, and keep working.</h2><p>Use the same private, straightforward workflow for image OCR and Word compatibility problems.</p></div>
      <ImageToText/><WordCompatibilityFixer/>
    </section>
    <section className="features shell" id="how">
      <article><div className="feature-icon coral"><Languages/></div><h3>20-language conversion</h3><p>Language-aware OCR and Unicode-safe processing cover Latin, Indic, Arabic, Cyrillic, and CJK text.</p></article>
      <article><div className="feature-icon mint"><FileText/></div><h3>Actually editable</h3><p>Paragraphs become real Word content you can select, search, and change.</p></article>
      <article id="privacy"><div className="feature-icon blue"><LockKeyhole/></div><h3>Private by design</h3><p>Documents are handled by your conversion worker without third-party document services.</p></article>
    </section>
    <section className="seo-content shell" aria-labelledby="supported-languages">
      <div><span className="eyebrow">BUILT FOR REAL DOCUMENTS</span><h2 id="supported-languages">PDF and image OCR for 20 major languages</h2><p>Lipi keeps selectable PDF text in its original language and can OCR scanned pages or images. Choose Structured editable for flowing Word content, Textbox layout + editable for positioned text and images, or Exact visual copy when appearance matters most.</p></div>
      <p className="language-list"><strong>Supported languages:</strong> {languageNames.join(", ")}.</p>
      <h3>How conversion works</h3>
      <ol><li>Upload a PDF or supported image up to 20 MB.</li><li>Select the document language and output layout.</li><li>Download editable Word content or copy the recognized image text.</li></ol>
    </section>
    <footer className="shell"><span>Copyright 2026 Lipi</span><span>Multilingual document conversion</span></footer>
  </main>;
}
