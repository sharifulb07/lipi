export interface PreprocessOptions { deskew?:boolean; denoise?:boolean; threshold?:number }
export async function preprocess(image:Uint8Array,options:PreprocessOptions={}):Promise<Uint8Array>{ void options; return image }
