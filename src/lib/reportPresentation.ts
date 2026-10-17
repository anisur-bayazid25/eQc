/** Add native disclosures to every generated table, including research-record tables. */
export function presentReport(html: string): string {
  let section = 'Report details', tableIndex = 0, sectionIndex = 0;
  const links: string[] = [];
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>|<table\b[^>]*>[\s\S]*?<\/table>/g, (block, level, heading) => {
    if (heading !== undefined) {
      section = heading;
      if (level === '2') {
        const id = `report-section-${++sectionIndex}`;
        links.push(`<a href="#${id}">${heading}</a>`);
        return `<h2 id="${id}">${heading}</h2>`;
      }
      return block;
    }
    const rows = (block.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr\b/g) || []).length;
    const id = `report-table-${++tableIndex}`;
    return `<details class="report-table"><summary aria-label="${section} table">View table <span class="muted">${rows} row${rows === 1 ? '' : 's'}</span></summary><label class="table-filter" hidden>Find in this table <input type="search" aria-controls="${id}" placeholder="Type to filter rows" /></label><div class="table-scroll" id="${id}" role="region" aria-label="${section}" tabindex="0">${block}</div><p class="filter-count" hidden aria-live="polite"></p></details>`;
  });
  return html.replace('<!-- REPORT_CONTENTS -->', `<nav class="report-contents" aria-label="Report contents">${links.join('')}</nav><div class="report-actions" hidden><button type="button" data-report-action="expand">Expand all sections</button><button type="button" data-report-action="collapse">Collapse all sections</button><button type="button" data-report-action="print">Print report</button></div>`);
}

export const reportStyles = `
  html { scroll-behavior: smooth; }
  body { line-height: 1.55; overflow-wrap: anywhere; }
  h1 { color: #0f172a; border: 0; } h2 { color: #0f172a; scroll-margin-top: 20px; }
  .stats { flex-wrap: wrap; gap: 12px; } .stat { flex: 1; min-width: 130px; }
  .report-contents { display:flex; flex-wrap:wrap; gap:8px 18px; padding:20px 0; border-bottom:1px solid #e2e8f0; }
  a { color:#1d4ed8; } .report-actions { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0; }
  [hidden] { display:none !important; }
  button,input { font:inherit; } button { cursor:pointer; padding:7px 12px; background:#fff; color:#1e293b; border:1px solid #cbd5e1; border-radius:6px; }
  details { border:1px solid #dbe2ea; border-radius:8px; margin:14px 0; padding:0 14px; background:#fff; }
  summary { cursor:pointer; padding:12px 0; font-weight:600; } summary .muted { font-size:13px; font-weight:400; margin-left:8px; color:#64748b; }
  .table-scroll { max-height:480px; overflow:auto; margin-bottom:14px; }
  table { margin:0; } th { position:sticky; top:0; z-index:1; } td { vertical-align:top; min-width:70px; max-width:450px; }
  tr:nth-child(even) td { background:#f8fafc; }
  .table-filter { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin:0 0 12px; font-size:14px; }
  .table-filter input { border:1px solid #cbd5e1; border-radius:5px; padding:6px 8px; max-width:100%; box-sizing:border-box; }
  .filter-count,.scope-note { color:#475569; font-size:13px; }
  .report-figure { margin:26px 0; } .report-figure img { display:block; width:100%; height:auto; border:1px solid #e2e8f0; background:#fff; }
  .memo { padding:0 14px; background:#fff; } .memo > div { padding-bottom:10px; }
  figcaption { margin-top:8px; } .visualization-note { white-space:pre-wrap; }
  @media(max-width:600px) { body { margin:20px auto; padding:0 12px; } h1 { font-size:26px; } .stats { gap:8px; } .stat { padding:10px; } }
  @media print { body { max-width:none; margin:0; font-size:10pt; } .report-actions,.report-contents,.table-filter,.filter-count { display:none !important; } .table-scroll { max-height:none; overflow:visible; } details { border:0; padding:0; } details.report-table:not([open]) > :not(summary) { display:block; } summary { font-size:11pt; } th { position:static; } table { font-size:9pt; } th,td { font-size:9pt; min-width:0; padding:4px; } thead { display:table-header-group; } .report-figure img { max-height:230mm; object-fit:contain; } h2,h3,figcaption { break-after:avoid; } }
`;

export const reportScript = `<script>
document.querySelector('.report-actions').hidden=false;
document.querySelectorAll('.table-filter').forEach(el=>el.hidden=false);
document.querySelectorAll('.table-filter input').forEach(input=>input.addEventListener('input',()=>{
  const details=input.closest('details'), rows=Array.from(details.querySelectorAll('tbody tr')), term=input.value.toLocaleLowerCase().trim();
  let visible=0; rows.forEach(row=>{row.hidden=!!term&&!row.textContent.toLocaleLowerCase().includes(term);if(!row.hidden)visible++;});
  const count=details.querySelector('.filter-count');count.hidden=!term;count.textContent=visible+' of '+rows.length+' rows shown';
}));
document.querySelectorAll('[data-report-action]').forEach(button=>button.addEventListener('click',()=>{
  const action=button.dataset.reportAction;
  if(action==='print'){window.print();return;}
  document.querySelectorAll('details').forEach(details=>details.open=action==='expand');
}));
let printState=[];
window.addEventListener('beforeprint',()=>{
  printState=Array.from(document.querySelectorAll('details')).map(details=>({details,open:details.open,hidden:Array.from(details.querySelectorAll('tbody tr')).filter(row=>row.hidden)}));
  printState.forEach(item=>{item.details.open=true;item.hidden.forEach(row=>row.hidden=false);});
});
window.addEventListener('afterprint',()=>{printState.forEach(item=>{item.details.open=item.open;item.hidden.forEach(row=>row.hidden=true);});printState=[];});
</script>`;
