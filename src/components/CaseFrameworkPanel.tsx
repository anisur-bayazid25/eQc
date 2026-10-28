import {saveExport} from '../lib/spreadsheetExport';
import IconButton from './IconButton';
import React, { useEffect, useRef, useMemo, useState } from 'react';
import Papa from 'papaparse';
import MatrixViewport from './MatrixViewport';
import { Project, uid } from '../domain';
import { emptyQuery, retrieveExcerpts } from '../lib/research';

type Props = { focusTarget?: {id:string;nonce:number}; project:Project; onChange:(p:Project)=>void; onOpen:(id:string)=>void; onMessage:(s:string)=>void };

export default function CaseFrameworkPanel({project,onChange,onOpen,onMessage,focusTarget}: Props) {
  const [selection,setSelection]=useState<{caseId:string;codeId:string}|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [attrs,setAttrs]=useState<string[]>([]),[page,setPage]=useState(0),[search,setSearch]=useState('');
  const [collapsed,setCollapsed]=useState(false),[evidencePage,setEvidencePage]=useState(0);
  const [width,setWidth]=useState(()=>{const saved=Number(localStorage.getItem('eqc-framework-drawer-width'));return saved>=600&&saved<=1400?saved:820;});
  const [dragging,setDragging]=useState(false);
  const workspace=useRef<HTMLDivElement>(null),latest=useRef(project);latest.current=project;
  const keys=useMemo(()=>Array.from(new Set(project.cases?.flatMap(c=>Object.keys(c.attributes))||[])).sort(),[project.cases]);
  const codes=useMemo(()=>project.codes.filter(c=>!c.parentId),[project.codes]);
  const cellMap=useMemo(()=>new Map((project.caseFrameworkCells||[]).map(c=>[`${c.caseId}::${c.codeId}`,c])),[project.caseFrameworkCells]);
  const filteredCases=useMemo(()=>(project.cases||[]).filter(c=>[c.name,c.id,...Object.entries(c.attributes).flat()].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())),[project.cases,search]);
  const pageCount=Math.max(1,Math.ceil(filteredCases.length/20)),currentPage=Math.min(page,pageCount-1),cases=filteredCases.slice(currentPage*20,currentPage*20+20);
  const selectedCase=project.cases?.find(c=>c.id===selection?.caseId),selectedCode=project.codes.find(c=>c.id===selection?.codeId);
  const cellKey=selection?`${selection.caseId}::${selection.codeId}`:'',savedCell=cellMap.get(cellKey),text=drafts[cellKey]??savedCell?.text??'';
  const dirty=text!==(savedCell?.text||'');
  const evidence=useMemo(()=>selection?retrieveExcerpts(project,{...emptyQuery(),caseIds:[selection.caseId],codeIds:[selection.codeId],descendants:true}):[],[project.cases,project.codedSegments,project.codes,project.docs,project.images,project.codedRegions,project.groups,selection]);
  const evidencePages=Math.max(1,Math.ceil(evidence.length/50)),currentEvidencePage=Math.min(evidencePage,evidencePages-1);
  useEffect(()=>{if(!focusTarget)return;const cell=project.caseFrameworkCells?.find(c=>c.id===focusTarget.id);if(cell){setSelection({caseId:cell.caseId,codeId:cell.codeId});setCollapsed(false);setEvidencePage(0);}},[focusTarget]);
  useEffect(()=>{
    if(!dragging)return;
    function move(e:PointerEvent){const right=workspace.current?.getBoundingClientRect().right??window.innerWidth;setWidth(Math.max(600,Math.min(1400,right-e.clientX)));}
    const stop=()=>setDragging(false);
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);};
  },[dragging]);
  useEffect(()=>{if(!dragging)localStorage.setItem('eqc-framework-drawer-width',String(width));},[width,dragging]);
  function saveSummary(){
    if(!selection)return;
    const current=latest.current,existing=current.caseFrameworkCells?.find(c=>c.caseId===selection.caseId&&c.codeId===selection.codeId);
    if((existing?.text||'')===text)return;
    const next={...current,caseFrameworkCells:[...(current.caseFrameworkCells||[]).filter(c=>!(c.caseId===selection.caseId&&c.codeId===selection.codeId)),{id:existing?.id||uid('case-framework'),...selection,text,updatedAt:Date.now()}]};
    latest.current=next;onChange(next);setDrafts(current=>{const next={...current};delete next[cellKey];return next;});onMessage('Case framework summary saved.');
  }
  async function exportMatrix(format:'xlsx'|'docx'){
    const headers=['Case ID','Case',...attrs,...codes.map(c=>c.name)];
    const rows=filteredCases.map(c=>[c.id,c.name,...attrs.map(k=>c.attributes[k]||''),...codes.map(code=>cellMap.get(`${c.id}::${code.id}`)?.text||'')]);
    try{if(format==='xlsx')await saveExport({title:'Case framework',defaultName:project.name+'_Case_framework.xlsx',extension:'xlsx',filterName:'Excel workbook',content:Papa.unparse([headers,...rows])});else await window.qv.exportDocxTable({kind:'table',title:'Case framework',filenameBase:project.name+'_Case_framework',headers,rows});}catch(e){onMessage(String(e));}
  }
  return <section className="case-framework-panel" aria-label="Case × theme framework">
    <div className="case-framework-heading"><div><h3>Case × theme framework</h3><p>Compare participant accounts across themes. Select a cell to write a summary and review its supporting passages.</p></div><span className="case-framework-count">{filteredCases.length} cases · {codes.length} themes</span></div>
    <div className="case-framework-toolbar">
      <label className="case-framework-search">Find a participant<input aria-label="Search framework cases" placeholder="Search name, ID or profile attributes…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/></label>
      <details className="case-framework-attributes"><summary>Attribute columns {attrs.length>0&&`(${attrs.length})`}</summary><div>{keys.map(key=><label key={key}><input type="checkbox" checked={attrs.includes(key)} onChange={()=>setAttrs(attrs.includes(key)?attrs.filter(k=>k!==key):[...attrs,key])}/>{key}</label>)}{!keys.length&&<p>Add profile attributes to your cases to display them here.</p>}</div></details>
      <div className="case-framework-exports"><button onClick={()=>exportMatrix('xlsx')}>Export Excel</button><button onClick={()=>exportMatrix('docx')}>Export Word</button></div>
    </div>
    {!project.cases?.length&&<p className="empty-hint">Create participant cases in Research tools, then select their text in the reader and choose Assign cases.</p>}
    {!codes.length&&<p className="empty-hint">Add top-level theme codes to start the framework matrix.</p>}
    <div className={`case-framework-workspace${dragging?' is-resizing':''}`} ref={workspace}>
      <div className="case-framework-grid">
        <MatrixViewport className="case-framework-table-wrap" label="Case framework matrix" rows={filteredCases} columns={codes} onRowJump={id=>setPage(Math.floor(filteredCases.findIndex(c=>c.id===id)/20))}><table className="matrix-table case-framework-table"><thead><tr><th scope="col">Case</th>{attrs.map(k=><th scope="col" key={k}>{k}</th>)}{codes.map(c=><th scope="col" key={c.id} data-matrix-column={c.id}><span className="code-swatch" style={{background:c.color}}/>{c.name}</th>)}</tr></thead><tbody>{cases.map(c=><tr key={c.id} data-matrix-row={c.id}><th scope="row">{c.name}</th>{attrs.map(k=><td key={k}>{c.attributes[k]||'—'}</td>)}{codes.map(code=>{
          const key=`${c.id}::${code.id}`,cell=cellMap.get(key),selected=key===cellKey;
          return <td key={code.id}><button className={`case-framework-cell${cell?.text?' has-summary':''}${selected?' is-selected':''}`} aria-label={'Case framework '+c.name+' '+code.name} aria-pressed={selected} onClick={()=>{setSelection({caseId:c.id,codeId:code.id});setCollapsed(false);setEvidencePage(0);}}><span>{cell?.text||'Add summary'}</span><small>{cell?.text?'Edit summary · view evidence':'View evidence'}</small></button></td>;
        })}</tr>)}</tbody></table></MatrixViewport>
        {pageCount>1&&<nav className="case-framework-pagination" aria-label="Case framework pages"><button disabled={!currentPage} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage+1} of {pageCount}</span><button disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></nav>}
      </div>
      {selection&&selectedCase&&selectedCode&&<aside className={`case-framework-drawer${collapsed?' is-collapsed':''}`} aria-label="Framework summary editor" style={{width:collapsed?48:width}}>
        {!collapsed&&<div className="case-framework-resizer" role="separator" aria-label="Resize framework editor" aria-orientation="vertical" aria-valuemin={600} aria-valuemax={1400} aria-valuenow={width} tabIndex={0} onPointerDown={e=>{e.preventDefault();setDragging(true);}} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(w=>Math.max(600,Math.min(1400,w+(e.key==='ArrowLeft'?24:-24))));}}}/>}
        {collapsed?<button className="case-framework-expand" aria-label="Expand framework editor" onClick={()=>setCollapsed(false)}>‹ <span>Summary & evidence</span></button>:<>
          <header className="case-framework-drawer-header"><div><small>CASE × THEME</small><h3>{selectedCase.name}</h3><p>{selectedCode.name}</p></div><div><button title="Collapse editor" aria-label="Collapse framework editor" onClick={()=>setCollapsed(true)}>›</button><button title="Close editor" aria-label="Close framework editor" onClick={()=>setSelection(null)}>×</button></div></header>
          <div className="case-framework-drawer-body analysis-two-column-editor">
            <div className="analysis-writing-column">
            <label className="case-framework-summary">Analytic summary<textarea aria-label="Case framework summary" placeholder="Summarise this participant’s account of the theme…" value={text} onChange={e=>setDrafts({...drafts,[cellKey]:e.target.value})} onBlur={saveSummary}/></label>
            <div className="case-framework-save"><small>{dirty?'Unsaved changes · saves when you leave the field':'Changes saved on leaving the field'}</small><IconButton icon="save" label="Save case framework summary" className="primary-btn" disabled={!dirty} onClick={saveSummary}/></div>
            </div><div className="analysis-evidence-column">
            <div className="case-framework-evidence-heading"><h4>Supporting evidence</h4><span>{evidence.length} supporting coding entries</span></div>
            <p className="section-hint">Includes subcodes. Shared passages contribute to each linked case. Summaries reflect your interpretation of this evidence.</p>
            {!evidence.length&&<p className="empty-hint">No coded passages match this case and theme yet. Assign participant passages in the reader to bring their coding here.</p>}
            {evidence.slice(currentEvidencePage*50,currentEvidencePage*50+50).map(e=><article className="case-framework-evidence" key={e.id}><header><strong>{e.sourceName}</strong><small>{project.codes.find(c=>c.id===e.codeId)?.name} · Coded by {e.coder}</small></header><p>{e.text||'Image region'}</p><IconButton icon="open" label="Open supporting source" onClick={()=>onOpen(e.id)}/></article>)}
            {evidencePages>1&&<nav className="case-framework-pagination" aria-label="Framework evidence pages"><button disabled={!currentEvidencePage} onClick={()=>setEvidencePage(currentEvidencePage-1)}>Previous passages</button><span>{currentEvidencePage+1} / {evidencePages}</span><button disabled={currentEvidencePage+1>=evidencePages} onClick={()=>setEvidencePage(currentEvidencePage+1)}>Next passages</button></nav>}
            {project.memos?.filter(m=>m.caseIds.includes(selection.caseId)&&(!m.codeIds.length||m.codeIds.includes(selection.codeId))).map(m=><article className="case-framework-evidence" key={m.id}><strong>{m.title}</strong><p>{m.text}</p></article>)}
            </div>
          </div>
        </>}
      </aside>}
    </div>
  </section>;
}
