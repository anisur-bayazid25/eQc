const JSZip = require('jszip');
const escape = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const column = index => { let name=''; for(let n=index+1;n;n=Math.floor((n-1)/26)) name=String.fromCharCode(65+(n-1)%26)+name; return name; };
async function buildMemoWorkbook(sheets) {
  const zip = new JSZip();
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${escape(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`);
  sheets.forEach((s,i) => {
    const rows = [s.headers,...s.rows].flatMap(row => {
      // Excel limits each cell to 32,767 characters. Continuation rows retain
      // every character of long memos rather than silently truncating them.
      const chunks=row.map(value=>{const text=String(value ?? ''),parts=[];let start=0;while(start<text.length){let end=Math.min(start+32767,text.length);if(end<text.length && /[\uD800-\uDBFF]/.test(text[end-1]))end--;parts.push(text.slice(start,end));start=end;}return parts.length?parts:[''];});
      const parts = Math.max(1,...chunks.map(c=>c.length));
      // Repeat short source/identity fields on continuation rows so a long
      // memo never loses its provenance when rows are filtered or copied.
      return Array.from({length:parts},(_,part)=>chunks.map(c=>c.length===1?c[0]:c[part] || ''));
    });
    zip.file(`xl/worksheets/sheet${i+1}.xml`, `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>`<c r="${column(c)}${r+1}" t="inlineStr"><is><t xml:space="preserve">${escape(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${column(s.headers.length-1)}${rows.length}"/></worksheet>`);
  });
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
module.exports = {buildMemoWorkbook};
