import { hasBengaliUnicode,looksLikeBijoy } from "bijoy2unicode";
import { LEGACY_FONT_NAMES } from "./glyph-map";
export type BanglaEncoding="unicode"|"legacy"|"unknown";
export function detectBanglaEncoding(text:string,fonts:string[]=[]):BanglaEncoding{
  const names=fonts.map(font=>font.toLowerCase().replace(/[^a-z0-9]/g,""));
  if(names.some(font=>LEGACY_FONT_NAMES.some(legacy=>font.includes(legacy))))return"legacy";
  // A PDF text item can contain already-Unicode Bengali next to legacy Bijoy
  // glyphs. Check for legacy glyphs before accepting the whole item as
  // Unicode; the converter leaves existing Bengali code points unchanged.
  if(looksLikeBijoy(text.replaceAll("\u03bc","\u00b5")))return"legacy";
  return hasBengaliUnicode(text)?"unicode":"unknown";
}
