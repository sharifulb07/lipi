import { containsBangla } from "../bangla/normalize";
export const BENGALI_FONT="Nirmala UI"; export const LATIN_FONT="Aptos";
export function isRightToLeftText(text:string){return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u.test(text)}
function fallbackFont(text:string){
 if(containsBangla(text)||/[\u0900-\u097f\u0b80-\u0bff\u0c00-\u0c7f]/u.test(text))return "Nirmala UI";
 if(isRightToLeftText(text))return "Arial";
 if(/[\u3040-\u30ff]/u.test(text))return "Yu Gothic";
 if(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(text))return "Microsoft JhengHei";
 return LATIN_FONT;
}
export function fontForText(text:string,pdfFont?:string){
 const family=pdfFont?.split(",")[0]?.replace(/['"]/g,"").trim();
 if(containsBangla(text)){
  const unicodeBengali=/nirmala|noto.*beng|solaiman|kalpurush|nikosh|siyam|vrinda|shonar|bangla|bengali/i;
  return family&&unicodeBengali.test(family)?family:BENGALI_FONT;
 }
 const generic=!family||/^(sans-serif|serif|monospace|system-ui)$/i.test(family)||/^g_d\d+_f\d+$/i.test(family);
 return generic?fallbackFont(text):family;
}
