import { legacyFragmentsToUnicode } from "../lib/bangla/legacy-to-unicode";
import { detectBanglaEncoding } from "../lib/bangla/detect-encoding";
import { normalizeBangla } from "../lib/bangla/normalize";
import { createDocument } from "../lib/docx/create-document";
import { createFixedLayoutDocument } from "../lib/docx/create-fixed-layout-document";
import { createLayoutDocument } from "../lib/docx/create-layout-document";
import { renderPages } from "../lib/pdf/render-page";
import { analyzeLayout } from "../lib/ocr/layout-analysis";
import { recognizePage } from "../lib/ocr/tesseract";
import { analyzeExtractedPdf } from "../lib/pdf/analyze";
import { extractText } from "../lib/pdf/extract-text";
import { extractPositionedImages } from "../lib/pdf/extract-positioned-images";
import type { ConversionLanguage,ExtractedPage } from "../lib/types";
import { getJob,updateJob } from "../lib/queue/conversion-queue";
import { getObject,putObject } from "../lib/storage/storage";

async function addOcrText(input:Uint8Array,pages:ExtractedPage[],language:ConversionLanguage,onPage:(current:number,total:number)=>void){
  const rendered=await renderPages(input,200),scale=72/200;
  const emptyPages=pages.filter(page=>page.lines.reduce((sum,line)=>sum+line.text.trim().length,0)+page.tables.reduce((sum,table)=>sum+table.rows.flat().reduce((cellSum,cell)=>cellSum+cell.text.trim().length,0),0)<30);
  for(let index=0;index<emptyPages.length;index++){
    const page=emptyPages[index],image=rendered[page.pageNumber-1];
    if(!image)continue;
    onPage(index+1,emptyPages.length);
    const blocks=analyzeLayout(await recognizePage(image.png,language));
    page.tables=[];
    page.lines=blocks.map(block=>{
      const x=block.x*scale,width=block.width*scale,height=Math.max(1,block.height*scale),right=page.width-x-width;
      const alignment=Math.abs(x-right)<=Math.max(6,page.width*.025)?"center":right<=page.width*.18&&x>=page.width*.45?"right":"left";
      return{text:block.text,x,y:page.height-(block.y+block.height)*scale,width,height,fontSize:height*.85,alignment,color:"000000"};
    });
  }
}

export async function processConversion(id:string){
  const job=getJob(id);
  if(!job)return;
  try{
    const input=await getObject(job.inputKey);
    let output:Uint8Array;

    if(job.options?.mode==="preserve-layout"){
      updateJob(id,{status:"generating",progress:20,message:"Rendering exact page appearance"});
      const pages=await renderPages(input,0,{format:"jpeg",quality:90,concurrency:1,onPage:(completed,total)=>updateJob(id,{progress:20+Math.round(completed/total*60),message:`Rendering page ${completed} of ${total}`})});
      updateJob(id,{status:"generating",progress:84,message:"Creating optimized visual Word document"});
      output=await createLayoutDocument(pages);
    }else{
      updateJob(id,{status:"analyzing",progress:12,message:"Analyzing PDF"});
      const extracted=await extractText(input);
      const analysis=analyzeExtractedPdf(extracted.pages,extracted.fonts);
      updateJob(id,{analysis,status:"extracting",progress:35,message:"Extracting positioned content"});

      if(analysis.kind==="scanned"&&!job.options?.ocr)throw new Error("This PDF contains scanned pages. Enable OCR or choose Exact visual copy.");
      {
        const {pages}=extracted;
        if(job.options?.ocr&&(analysis.kind==="scanned"||analysis.kind==="mixed")){
          updateJob(id,{status:"extracting",progress:42,message:"Running OCR on scanned pages"});
          await addOcrText(input,pages,job.options.language,(current,total)=>updateJob(id,{progress:42+Math.round(current/Math.max(1,total)*14),message:`OCR page ${current} of ${total}`}));
        }
        updateJob(id,{status:"normalizing",progress:58,message:"Normalizing editable text"});
        const normalizeText=(text:string,fontName?:string,fontFamily?:string)=>{
          const fonts=[fontFamily,fontName,...analysis.fonts].filter((font):font is string=>Boolean(font));
          const encoding=detectBanglaEncoding(text,fonts);
          if(encoding==="legacy")return normalizeBangla(legacyFragmentsToUnicode(text));
          return /[\u0980-\u09FF]/u.test(text)?normalizeBangla(text):text.normalize("NFC").trim();
        };
        for(const page of pages)for(const line of page.lines){
          if(line.spans?.length){
            for(const span of line.spans)span.text=normalizeText(span.text,span.fontName,span.fontFamily);
            line.text=line.spans.map(span=>span.text).join(" ");
          }else line.text=normalizeText(line.text,line.fontName,line.fontFamily);
        }
        for(const page of pages)for(const table of page.tables)for(const row of table.rows)for(const cell of row){
          cell.text=normalizeText(cell.text,cell.fontName,cell.fontFamily);
        }
        if(job.options?.mode==="fixed-layout"){
          updateJob(id,{status:"generating",progress:68,message:"Extracting and positioning PDF images"});
          const images=await extractPositionedImages(input);
          updateJob(id,{status:"generating",progress:78,message:"Positioning editable text and images"});
          output=await createFixedLayoutDocument(pages,images);
        }else{
          updateJob(id,{status:"generating",progress:82,message:"Creating editable Word document"});
          output=await createDocument(pages);
        }
      }
    }

    updateJob(id,{status:"generating",progress:92,message:"Packaging Word document"});
    const key=`outputs/${id}.docx`;
    await putObject(key,output);
    updateJob(id,{status:"completed",progress:100,message:"Conversion complete",outputKey:key,error:undefined});
  }catch(error){
    console.error("Conversion job failed",error);
    updateJob(id,{status:"failed",progress:100,message:"Conversion failed",error:error instanceof Error?error.message:"Unknown error"});
  }
}




