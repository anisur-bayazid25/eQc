import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { createWorker } from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractBengaliTextFromPDF(
  file: File,
  onProgress?: (msg: string) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  // 1. Initialize worker ONCE with BOTH Bengali and English models
  if (onProgress) onProgress('Initializing OCR engine (Bengali + English)...');
  const worker = await createWorker(['ben', 'eng']);

  let fullText = '';

  try {
    for (let i = 1; i <= totalPages; i++) {
      if (onProgress) onProgress(`Reading page ${i} of ${totalPages}...`);

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 }); // High DPI for crisp OCR accuracy

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      // Convert canvas render to image data
      const imageData = canvas.toDataURL('image/png');

      // Run OCR on the page
      const { data: { text } } = await worker.recognize(imageData);

      // Clean up common ebook scanner watermarks (e.g., /%/%/.891783...)
      const cleanedText = text
        .replace(/\/\%\/\%\/\.[\d\.\-]+/g, '') // Strips repeating digital watermark strings
        .replace(/\n{3,}/g, '\n\n')            // Trims excess blank line spacing
        .trim();

      fullText += `--- Page ${i} ---\n\n${cleanedText}\n\n`;
    }
  } finally {
    // 2. Shut down worker thread after all pages finish
    await worker.terminate();
  }

  return fullText;
}