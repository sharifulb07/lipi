import { convertBijoyToUnicode,scanUnmapped } from "bijoy2unicode";

// PDF text extraction occasionally converts the Bijoy micro-sign byte into
// the visually similar Greek mu. Bijoy uses that byte in conjunct sequences.
function normalizeExtractedBijoy(text:string){
  return text.replaceAll("\u03bc","\u00b5").replaceAll("\u2019","\u2019");
}

export function legacyToUnicode(input:string){
  const source=normalizeExtractedBijoy(input);
  const text=convertBijoyToUnicode(source);
  return {text,converted:text!==input,unmapped:[...scanUnmapped(text).entries()]};
}
export function legacyFragmentsToUnicode(input:string){
  const parts=input.split(/([\u0980-\u09FF]+)/);
  return parts.map(part=>/[\u0980-\u09FF]/.test(part)||!/[A-Za-z0-9\u00A0-\u02FF]/.test(part)?part:legacyToUnicode(part).text).join("");
}
