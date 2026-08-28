import type { ConversionLanguage } from "./types";
export interface ConversionLanguageOption { value:ConversionLanguage; label:string; tesseract:string }
export const CONVERSION_LANGUAGES:readonly ConversionLanguageOption[]=[
 {value:"auto",label:"Keep original language (recommended)",tesseract:"eng+ben"},
 {value:"eng",label:"English",tesseract:"eng"},
 {value:"chi_sim",label:"Mandarin Chinese (Simplified)",tesseract:"chi_sim"},
 {value:"hin",label:"Hindi",tesseract:"hin"},
 {value:"spa",label:"Spanish",tesseract:"spa"},
 {value:"fra",label:"French",tesseract:"fra"},
 {value:"ara",label:"Standard Arabic",tesseract:"ara"},
 {value:"ben",label:"Bengali",tesseract:"ben"},
 {value:"rus",label:"Russian",tesseract:"rus"},
 {value:"por",label:"Portuguese",tesseract:"por"},
 {value:"urd",label:"Urdu",tesseract:"urd"},
 {value:"ind",label:"Indonesian",tesseract:"ind"},
 {value:"deu",label:"Standard German",tesseract:"deu"},
 {value:"jpn",label:"Japanese",tesseract:"jpn"},
 {value:"pcm",label:"Nigerian Pidgin",tesseract:"eng"},
 {value:"mar",label:"Marathi",tesseract:"mar"},
 {value:"tel",label:"Telugu",tesseract:"tel"},
 {value:"tur",label:"Turkish",tesseract:"tur"},
 {value:"tam",label:"Tamil",tesseract:"tam"},
 {value:"chi_tra",label:"Yue Chinese (Cantonese)",tesseract:"chi_tra"},
 {value:"vie",label:"Vietnamese",tesseract:"vie"},
 {value:"ben+eng",label:"Bengali + English",tesseract:"ben+eng"},
];
const languageMap=new Map(CONVERSION_LANGUAGES.map(language=>[language.value,language]));
export function isConversionLanguage(value:unknown):value is ConversionLanguage{return typeof value==="string"&&languageMap.has(value as ConversionLanguage)}
export function tesseractLanguageFor(value:ConversionLanguage){return languageMap.get(value)?.tesseract??"eng+ben"}
