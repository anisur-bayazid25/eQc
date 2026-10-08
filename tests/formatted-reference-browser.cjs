// Optional read-only rendering comparison. No source text, bytes or screenshots saved.
const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const mammoth = require('mammoth');
const { htmlToText } = require('html-to-text');
const assert = require('node:assert/strict');
(async () => {
  assert.ok(process.env.EQC_WORD_REFERENCE, 'Set EQC_WORD_REFERENCE to the reference DOCX.');
  const buffer = fs.readFileSync(process.env.EQC_WORD_REFERENCE);
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const canonical = htmlToText(html, { wordwrap: false, selectors: [{ selector:'table',format:'dataTable' },{selector:'img',format:'skip'}] });
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage();
    await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5173');
    const result = await page.evaluate(async ({canonical,base64}) => {
      const { renderAsync } = await import('/node_modules/.vite/deps/docx-preview.js');
      const { mapFormattedText, mappedSelection, originalBytes, collectMappedNodes } = await import('/src/lib/formattedMapping.ts');
      const root=document.createElement('div'),styles=document.createElement('div');document.body.append(root,styles);
      await renderAsync(originalBytes(base64),root,styles,{useBase64URL:true,renderAltChunks:false,renderChanges:false});
      const {text}=collectMappedNodes(root,node=>!!node.parentElement.closest('article')&&!node.parentElement.closest('sup'));
      const mapping=mapFormattedText(canonical,text);
      let passages=0,rejected=0;
      let start=0;
      for(const paragraph of root.querySelectorAll('article p')) {
        const value=paragraph.textContent;if(!value.trim())continue;
        const location=text.indexOf(value,start);if(location<0)continue;
        if(mappedSelection(mapping,location,location+value.length))passages++;else rejected++;
        start=location+value.length;
      }
      return {paragraphs:root.querySelectorAll('article p').length,passages,rejected,matched:mapping.matched,characters:text.replace(/\s/g,'').length};
    },{canonical,base64:buffer.toString('base64')});
    assert.ok(result.passages>0);assert.ok(result.matched/result.characters>.98,JSON.stringify(result));
    console.log(JSON.stringify({result:'passed',...result}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
