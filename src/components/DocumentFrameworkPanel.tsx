import IconButton from './IconButton';
import React, {useEffect,useMemo,useState} from 'react';
import {Code,FrameworkCell,Project,SourceDoc} from '../domain';
import {emptyQuery,retrieveExcerpts} from '../lib/research';
import AnalysisDrawer from './AnalysisDrawer';
import MatrixViewport from './MatrixViewport';

function Summary({value,onSave}:{value:string;onSave:(text:string)=>void}) {
  const [text,setText]=useState(value);
  useEffect(()=>setText(value),[value]);
  return <div className="analysis-writing-column"><label className="case-framework-summary">Analytic summary<textarea autoFocus aria-label="Document framework summary" value={text} placeholder="Summarise this document’s account of the theme…" onChange={e=>setText(e.target.value)} onBlur={()=>{if(text!==value)onSave(text);}}/></label><small className="section-hint">Saves when you leave the field.</small></div>;
}

export default function DocumentFrameworkPanel({project,rows,docs,cells,onSave,onOpen,focusTarget}:{project:Project;rows:Code[];docs:SourceDoc[];cells:Map<string,FrameworkCell>;onSave:(docId:string,codeId:string,text:string)=>void;onOpen:(id:string)=>void;focusTarget?:{id:string;nonce:number}}) {
  const [selection,setSelection]=useState<{docId:string;codeId:string}|null>(null),[limit,setLimit]=useState(50);
  const doc=project.docs.find(d=>d.id===selection?.docId),code=project.codes.find(c=>c.id===selection?.codeId);
  const evidence=useMemo(()=>selection?retrieveExcerpts(project,{...emptyQuery(),docIds:[selection.docId],codeIds:[selection.codeId],descendants:true}):[],[selection,project.docs,project.codes,project.codedSegments,project.codedRegions,project.cases,project.images,project.groups]);
  useEffect(()=>{if(!focusTarget)return;const cell=project.frameworkCells?.find(c=>c.id===focusTarget.id);if(cell)setSelection({docId:cell.docId,codeId:cell.codeId});},[focusTarget]);
  useEffect(()=>setLimit(50),[selection]);
  return <div className="document-framework-workspace">
    <MatrixViewport label="Document framework matrix" rows={rows} columns={docs}>
      <table className="matrix-table framework-matrix-table"><thead><tr><th>Theme</th>{docs.map(d=><th key={d.id} data-matrix-column={d.id}>{d.name}</th>)}</tr></thead><tbody>{rows.map(c=><tr key={c.id} data-matrix-row={c.id}><th scope="row" className="matrix-code-cell"><span className="code-swatch" style={{background:c.color}}/>{c.name}</th>{docs.map(d=>{const cell=cells.get(`${d.id}::${c.id}`),selected=selection?.docId===d.id&&selection?.codeId===c.id;return <td key={d.id} id={cell?'analysis-memo-'+cell.id:undefined}><button aria-label={`Document framework ${d.name} ${c.name}`} aria-pressed={selected} className={`case-framework-cell${cell?.text?' has-summary':''}${selected?' is-selected':''}`} onClick={()=>setSelection({docId:d.id,codeId:c.id})}><span>{cell?.text||'Add summary'}</span><small>Summary & evidence</small></button></td>;})}</tr>)}</tbody></table>
      {!rows.length&&<p className="empty-hint">Add top-level theme codes to start the framework matrix.</p>}{!docs.length&&<p className="empty-hint">No documents yet.</p>}
    </MatrixViewport>
    {selection&&doc&&code&&<AnalysisDrawer name="Document framework editor" title={doc.name+' · '+code.name} subtitle="DOCUMENT × THEME" storageKey="eqc-document-framework-drawer-width" onClose={()=>setSelection(null)}>
      <Summary key={doc.id+'::'+code.id} value={cells.get(`${doc.id}::${code.id}`)?.text||''} onSave={text=>onSave(doc.id,code.id,text)}/>
      <section className="analysis-evidence-column"><header className="case-framework-evidence-heading"><h4>Supporting evidence</h4><span>{evidence.length} coding entries</span></header><p className="section-hint">Includes subcodes from this document.</p>
        {evidence.slice(0,limit).map(e=><article key={e.id} className="case-framework-evidence"><header><strong>{e.sourceName}</strong><small>{project.codes.find(c=>c.id===e.codeId)?.name} · Coded by {e.coder}</small></header><p>{e.text||'Image region'}</p><IconButton icon="open" label="Open supporting source" onClick={()=>onOpen(e.id)}/></article>)}
        {!evidence.length&&<p className="empty-hint">No coding matches this document and theme yet.</p>}{evidence.length>limit&&<button onClick={()=>setLimit(n=>n+50)}>Show next 50 passages</button>}
      </section>
    </AnalysisDrawer>}
  </div>;
}
