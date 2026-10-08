import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { createWorker } from 'tesseract.js';
pdfjsLib.GlobalWorkerOptions.workerSrc=pdfWorker;
export async function extractBengaliTextFromPDF(file:File,onProgress?:(msg:string)=>void):Promise<string> {
  const task=pdfjsLib.getDocument({data:await file.arrayBuffer()});
  let worker:Awaited<ReturnType<typeof createWorker>>|undefined;
  const text:string[]=[];
  try {
    const pdf=await task.promise;
    onProgress?.('Initializing OCR engine (Bengali + English)...');worker=await createWorker(['ben','eng']);
    for(let i=1;i<=pdf.numPages;i++) {
      onProgress?.(`Reading page ${i} of ${pdf.numPages}...`);
      const page=await pdf.getPage(i),base=page.getViewport({scale:1});
      const scale=Math.min(2,Math.sqrt(8000000/(base.width*base.height))),viewport=page.getViewport({scale});
      const canvas=document.createElement('canvas');
      try {
        canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));
        const context=canvas.getContext('2d');if(!context)throw new Error('OCR could not create a page canvas.');
        await page.render({canvasContext:context,viewport}).promise;
        // Pass the canvas directly: avoid a second full-page base64 PNG string.
        const result=await worker.recognize(canvas);
        const cleaned=result.data.text.replace(/\/\%\/\%\/\.[\d\.\-]+/g,'').replace(/\n{3,}/g,'\n\n').trim();
        text.push(`--- Page ${i} ---\n\n${cleaned}\n\n`);
      } finally {canvas.width=0;canvas.height=0;page.cleanup();}
    }
    return text.join('');
  } finally {await Promise.allSettled([worker?.terminate(),task.destroy()]);}
}
