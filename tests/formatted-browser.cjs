// In-memory research fixtures; no user database/files are modified.
const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Header } = require('docx');
const mammoth = require('mammoth');
const { htmlToText } = require('html-to-text');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function simplePdf(scan = false) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  for (const text of ['PDF first page. Repeated phrase.', 'PDF second page. Repeated phrase.']) {
    const stream = `${scan ? '' : `BT /F1 16 Tf 60 700 Td (${text}) Tj ET\n`}0 0 1 RG 60 550 200 80 re S`;
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let result = '%PDF-1.4\n', offsets = [0];
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
(async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=', 'base64');
  const word = await Packer.toBuffer(new Document({ sections: [{ headers: { default: new Header({ children: [new Paragraph('Header outside coding text')] }) }, children: [
    new Paragraph({ text: 'Interview heading', heading: 'Heading1' }),
    new Paragraph({ children: [new TextRun({ text: 'Repeated phrase.', bold: true, color: 'B00020', size: 28 }), new TextRun(' First context.')] }),
    new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('Question')] }), new TableCell({ children: [new Paragraph('বাংলা response')] })] })] }),
    new Paragraph('Repeated phrase. Second context.'),
    new Paragraph({ children: [new ImageRun({ data: png, type:'png', transformation: { width: 40, height: 40 } })] })
  ] }] }));
  const { value: html } = await mammoth.convertToHtml({ buffer: word });
  const wordText = htmlToText(html, { wordwrap:false, selectors:[{selector:'table',format:'dataTable'},{selector:'img',format:'skip'}] });
  const pdf = simplePdf(), pdfText = '\n\nPDF first page. Repeated phrase.\n\nPDF second page. Repeated phrase.';
  const original = (buffer,format,content) => ({ name:`Original.${format}`,format,base64:buffer.toString('base64'),textHash:crypto.createHash('sha256').update(content).digest('hex') });
  const project = { id:'formatted',name:'Formatted research',createdAt:1,folders:[],docs:[
    {id:'word',name:'Interview.docx',folderId:null,content:wordText,original:original(word,'docx',wordText)},
    {id:'pdf',name:'Report.pdf',folderId:null,content:pdfText,original:original(pdf,'pdf',pdfText)},
    {id:'scan',name:'Scanned.pdf',folderId:null,content:'OCR text for the scanned source',original:original(simplePdf(true),'pdf','OCR text for the scanned source')},
    {id:'edited',name:'Edited.docx',folderId:null,content:wordText+'\nChanged text',original:{...original(word,'docx',wordText),textChanged:false}},
    {id:'broken',name:'Broken.docx',folderId:null,content:'Recoverable coding text',original:original(Buffer.from('Not a ZIP'),'docx','Recoverable coding text')}
  ],codes:[{id:'theme',name:'Theme',color:'#2563eb',summary:'',parentId:null,createdAt:1}],images:[],codedRegions:[],codedSegments:[] };
  const browser = await chromium.launch({ channel:'msedge',headless:true });
  try {
    const page = await browser.newPage({viewport:{width:1366,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(project => {
      localStorage.setItem('qda-document-view','formatted');
      window.__qaProject = project;
      window.qv = new Proxy({listProjects:async()=>[{id:project.id,name:project.name}],loadProject:async()=>project,saveProject:async p=>{window.__qaProject=structuredClone(p);return p;},lan:new Proxy({},{get:(_,n)=>String(n).startsWith('on')?()=>{}:async()=>({ok:true})})},{get:(t,n)=>t[n]||(String(n).startsWith('on')?()=>{}:async()=>null)});
    },project);
    await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5173');
    await page.locator('.workspace-sources .doc-row').filter({hasText:'Interview.docx'}).click();
    await page.locator('.word-document-body article table').waitFor();
    await page.waitForFunction(()=>{const el=document.querySelector('.word-document-body'),parent=el.parentElement;return el.getBoundingClientRect().width <= parent.clientWidth + 2;});
    async function checkToolbarFlow(bodySelector) {
      const layout=await page.evaluate(selector=>{
        const scroll=document.getElementById('doc-scroll-container'),toolbar=scroll.querySelector('.formatted-toolbar'),body=scroll.querySelector(selector);
        scroll.scrollTop=0;const start=toolbar.getBoundingClientRect(),bodyTop=body.getBoundingClientRect().top;
        scroll.scrollTop=150;const delta=scroll.scrollTop,moved=start.top-toolbar.getBoundingClientRect().top;scroll.scrollTop=0;
        return {bodyTop,toolbarBottom:start.bottom,delta,moved,position:getComputedStyle(toolbar).position};
      },bodySelector);
      assert.equal(layout.position,'static');assert.ok(layout.bodyTop>=layout.toolbarBottom,'Toolbar reserves space above source content');
      assert.ok(layout.delta>10,'Fixture can scroll');assert.ok(Math.abs(layout.moved-layout.delta)<2,'Zoom ribbon scrolls with the source instead of overlaying it');
    }
    await checkToolbarFlow('.word-document-body');
    assert.ok(await page.locator('.word-document-body img').count());
    assert.ok(await page.locator('.word-document-body header').count());
    const out=path.resolve('release/formatted-qa');fs.mkdirSync(out,{recursive:true});
    await page.screenshot({path:path.join(out,'word.png')});
    async function selectText(selector, phrase, last=false) {
      await page.evaluate(({selector,phrase,last})=>{
        const root=document.querySelector(selector), walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        const hits=[];let node;while(node=walker.nextNode()){const i=node.data.indexOf(phrase);if(i>=0)hits.push({node,i});}
        const hit=last?hits.at(-1):hits[0];if(!hit)throw Error('Phrase absent: '+phrase);
        const range=document.createRange();range.setStart(hit.node,hit.i);range.setEnd(hit.node,hit.i+phrase.length);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      },{selector,phrase,last});
    }
    async function apply() {
      await page.locator('.right-panel .code-search-input').fill('Theme');
      await page.locator('.right-panel .code-search-row').click();
    }
    await selectText('.word-document-body article','Repeated phrase.',true);
    await page.locator('.selection-hint').filter({hasText:'Selected'}).waitFor();
    await apply();
    await page.waitForFunction(()=>window.__qaProject.codedSegments.length===1);
    let saved=await page.evaluate(()=>window.__qaProject);
    assert.equal(saved.codedSegments[0].start,wordText.lastIndexOf('Repeated phrase.'));
    assert.equal(saved.codedSegments[0].text,'Repeated phrase.');
    await page.locator('.word-document-body [data-seg-ids]').first().waitFor();
    await selectText('.word-document-body article','phrase.',true);await apply();
    await page.waitForFunction(()=>window.__qaProject.codedSegments.length===2);
    assert.ok(await page.locator('.word-document-body [data-seg-ids]').evaluateAll(nodes=>nodes.some(n=>n.dataset.segIds.split(' ').length===2)),'overlapping coding was not retained');
    await selectText('.word-document-body','Header outside coding text');
    assert.equal(await page.locator('.selection-hint').count(),0,'header was incorrectly treated as body coding text');
    await selectText('.word-document-body article','বাংলা response');await apply();
    await page.waitForFunction(()=>window.__qaProject.codedSegments.length===3);
    saved=await page.evaluate(()=>window.__qaProject);
    assert.equal(saved.codedSegments[2].start,wordText.indexOf('বাংলা response'));
    await page.getByRole('button',{name:'Plain text',exact:true}).click();
    assert.equal(await page.locator('.doc-editor').textContent(),wordText);
    assert.equal(saved.docs[0].original.base64,word.toString('base64'));
    await page.locator('.workspace-sources .doc-row').filter({hasText:'Report.pdf'}).click();
    await page.getByRole('button',{name:'Original view',exact:true}).click();
    await page.locator('.pdf-text-layer').getByText('PDF first page.',{exact:false}).waitFor();
    await checkToolbarFlow('.pdf-sheet');
    await page.getByLabel('PDF page',{exact:true}).selectOption('2');
    await page.locator('.pdf-text-layer').getByText('PDF second page.',{exact:false}).waitFor();
    await selectText('.pdf-text-layer','Repeated phrase.');await apply();
    await page.waitForFunction(()=>window.__qaProject.codedSegments.length===4);
    saved=await page.evaluate(()=>window.__qaProject);
    assert.equal(saved.codedSegments[3].start,pdfText.lastIndexOf('Repeated phrase.'));
    await page.getByLabel('PDF zoom',{exact:true}).selectOption('1.25');
    await page.locator('.pdf-text-layer [data-seg-ids]').first().waitFor();
    await page.getByRole('button',{name:'Region',exact:true}).click();
    const rect=await page.locator('.pdf-region-layer').boundingBox();
    await page.mouse.move(rect.x+60,rect.y+130);await page.mouse.down();await page.mouse.move(rect.x+250,rect.y+220);await page.mouse.up();
    await page.locator('.selection-hint').filter({hasText:'region selected'}).waitFor();await apply();
    await page.waitForFunction(()=>window.__qaProject.codedRegions.length===1);
    saved=await page.evaluate(()=>window.__qaProject);
    assert.equal(saved.images.length,1);assert.equal(saved.images[0].pdfPage.page,2);assert.equal(saved.images[0].pdfPage.docId,'pdf');
    assert.equal(saved.codedRegions[0].imageId,saved.images[0].id);
    assert.equal(saved.docs[1].original.base64,pdf.toString('base64'));
    await page.screenshot({path:path.join(out,'pdf.png')});
    const exported=await page.evaluate(async()=>{const {buildQdpxExport}=await import('/src/lib/qdpxExport.ts');const p=await buildQdpxExport(window.__qaProject);return {xml:p.qdeXml,files:Object.keys(p.sourceBytes)};});
    assert.ok(exported.xml.includes('<PDFSource'));assert.ok(exported.xml.includes('<PictureSource'));assert.ok(exported.xml.includes('<PictureSelection'));
    await page.getByLabel('PDF page',{exact:true}).selectOption('1');
    await page.getByLabel('PDF page',{exact:true}).selectOption('2');
    await page.locator('.pdf-region-mark').waitFor();
    // Navigation survives asynchronous original loading and chooses page 2.
    await page.getByLabel('PDF page',{exact:true}).selectOption('1');
    await page.locator('.tabs').getByRole('button',{name:'Codebook',exact:true}).click();
    await page.locator('.codebook-grid .code-row').filter({hasText:'Theme'}).click();
    await page.locator('.excerpt-card').filter({hasText:'Report.pdf'}).getByRole('button',{name:'📍 Go to Document',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[aria-label="PDF page"]')?.value==='2');
    await page.locator('.pdf-text-layer [data-seg-ids]').first().waitFor();
    await page.getByRole('button',{name:'Text',exact:true}).click();
    // Existing marks still open their coding controls after text-layer splitting.
    await page.locator('.pdf-text-layer [data-seg-ids]').first().click();
    await page.locator('.segment-popup').waitFor();
    await page.locator('.segment-popup-title').evaluate(el=>el.parentElement.previousElementSibling.click());
    await page.getByLabel('PDF zoom',{exact:true}).selectOption('fit');
    await page.setViewportSize({width:1024,height:768});
    await page.waitForFunction(()=>{const el=document.querySelector('.pdf-sheet');return el.getBoundingClientRect().width <= el.parentElement.clientWidth + 2;});
    await page.locator('.workspace-sources .doc-row').filter({hasText:'Scanned.pdf'}).click();
    await page.getByText('This page has no selectable text.',{exact:false}).waitFor();
    await page.getByRole('button',{name:'Region',exact:true}).click();
    const scanRect=await page.locator('.pdf-region-layer').boundingBox();
    await page.mouse.move(scanRect.x+20,scanRect.y+50);await page.mouse.down();await page.mouse.move(scanRect.x+100,scanRect.y+100);await page.mouse.up();await apply();
    await page.waitForFunction(()=>window.__qaProject.codedRegions.length===2);
    await page.locator('.workspace-sources .doc-row').filter({hasText:'Edited.docx'}).click();
    await page.locator('.word-document-body article table').waitFor();
    await selectText('.word-document-body article','Repeated phrase.',true);
    assert.equal(await page.locator('.selection-hint').count(),0,'stale original accepted new text coding');
    await page.getByText('The coding text has changed.',{exact:false}).waitFor();
    await page.locator('.workspace-sources .doc-row').filter({hasText:'Broken.docx'}).click();
    await page.getByRole('alert').filter({hasText:'Could not display the Word original'}).waitFor();
    await page.getByRole('button',{name:'Plain text',exact:true}).click();
    assert.equal(await page.locator('.doc-editor').textContent(),'Recoverable coding text');
    const pdfRow=page.locator('.workspace-sources .doc-row').filter({hasText:'Report.pdf'}).first();
    await pdfRow.hover();await pdfRow.getByTitle('Rename',{exact:true}).click();
    await page.locator('.modal input').fill('Renamed report.pdf');
    await page.locator('.modal').getByRole('button',{name:'Rename',exact:true}).click();
    await page.waitForFunction(()=>window.__qaProject.images.some(i=>i.name==='Renamed report.pdf — PDF page 2'));
    const renamed=page.locator('.workspace-sources .doc-row').filter({hasText:'Renamed report.pdf'}).first();
    await renamed.hover();await renamed.getByTitle('Delete',{exact:true}).click();
    await page.locator('.modal-overlay').getByRole('button',{name:'Delete',exact:true}).click();
    await page.waitForFunction(()=>!window.__qaProject.docs.some(d=>d.id==='pdf'));
    saved=await page.evaluate(()=>window.__qaProject);
    assert.equal(saved.images.length,1);assert.equal(saved.images[0].pdfPage.docId,'scan');
    assert.equal(saved.codedRegions.length,1,'deleting the parent PDF left linked region coding');
    assert.deepEqual(errors,[]);
    console.log('Formatted Word/table/Unicode/repeated-passage coding, PDF page/zoom/text/region coding, highlights, original-byte retention and QDPX export passed.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
