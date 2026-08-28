import { containsBangla } from "../bangla/normalize";
export function detectLanguage(text:string):"ben"|"eng"|"ben+eng" { const ben=containsBangla(text),eng=/[A-Za-z]/.test(text); return ben&&eng?"ben+eng":ben?"ben":"eng" }
