import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Project,normalizeCoderName} from '../domain';
import {collectIcrCoders} from '../lib/icr';
import {buildReportingIcrSummary} from '../lib/icrSummary';
import {buildManuscriptOutline} from '../lib/manuscript';
import {cropRegionToPng} from '../lib/imageCrop';
import IcrSummaryPanel from './IcrSummaryPanel';

export default function ManuscriptExportDialog({project,onClose,onMessage}:{project:Project;onClose:()=>void;onMessage:(message:string)=>void}) {
  const [framework,setFramework]=useState(true),[cooccurrence,setCooccurrence]=useState(true),[projectMemos,setProjectMemos]=useState(true);
  const [icrMethod,setIcrMethod]=useState<'source'|'comparison'>(project.icrComparison?'comparison':'source');
  const available=useMemo(()=>icrMethod==='comparison'&&project.icrComparison?.method==='training'?Array.from(new Set(project.icrComparison.training.map(row=>normalizeCoderName(row.coder)))):collectIcrCoders(project).attributed.map(c=>c.name),[project,icrMethod]);
  const [coders,setCoders]=useState(available),[docIds,setDocIds]=useState(project.docs.map(d=>d.id)),[includeImages,setIncludeImages]=useState(true);
  const [includeIcr,setIncludeIcr]=useState(available.length>=2),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>setCoders(available),[available]);
  const scope=useMemo(()=>({docIds,includeImages}),[docIds,includeImages]);
  const summary=useMemo(()=>buildReportingIcrSummary(project,coders,scope,icrMethod),[project,coders,scope,icrMethod]);
  const dialog=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;dialog.current?.focus();return()=>previous?.focus();},[]);
  const toggle=(list:string[],id:string)=>list.includes(id)?list.filter(value=>value!==id):[...list,id];
  return <div className="research-overlay"><div className="manuscript-dialog" role="dialog" aria-modal="true" aria-label="Manuscript skeleton" ref={dialog} tabIndex={-1} onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.stopPropagation();onClose();}if(event.key==='Tab'){const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')||[]);const first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}}>
    <header><h2>Manuscript skeleton</h2><button disabled={busy} onClick={onClose}>Close manuscript options</button></header>
    <p>Export project-wide code summaries and starred excerpts, with participant details beneath each quote. Without linked case details, the source name is used. Coder names, excerpt notes, case memos, document memos, annotations and visualization notes are omitted.</p>
    <fieldset><legend>Results content</legend>
      <label><input type="checkbox" checked={framework} onChange={event=>setFramework(event.target.checked)}/>Include framework memos</label>
      <label><input type="checkbox" checked={cooccurrence} onChange={event=>setCooccurrence(event.target.checked)}/>Include code co-occurrence memos</label>
      <label><input type="checkbox" checked={projectMemos} onChange={event=>setProjectMemos(event.target.checked)}/>Include analytic project memos</label>
      <p className="section-hint">Framework memos retain their code heading without source names. Linked analytic project memos appear once under a code; other analytic project memos appear after the code sections. Saved memo text is kept as written.</p>
    </fieldset>
    <fieldset><legend>Methodology before results</legend>
      <label><input type="checkbox" checked={includeIcr} disabled={available.length<2&&!includeIcr} onChange={event=>setIncludeIcr(event.target.checked)}/>Include ICR paragraph</label>
      {available.length<2&&<p>ICR is unavailable: fewer than two attributed coders.</p>}
      {includeIcr&&<><label>Statistics to report<select aria-label="Manuscript ICR method" value={icrMethod} onChange={event=>setIcrMethod(event.target.value as 'source'|'comparison')}><option value="source">Source-level code presence</option><option value="comparison" disabled={!project.icrComparison}>Saved additional comparison</option></select></label><details><summary>ICR scope — {coders.length} coders, {docIds.length} text documents{includeImages?`, ${(project.images||[]).length} images`:''}</summary>
        <strong>Coders</strong>{available.map(coder=><label key={coder}><input type="checkbox" checked={coders.includes(coder)} onChange={()=>setCoders(toggle(coders,coder))}/>{coder}</label>)}
        <strong>Text documents</strong>{project.docs.map(doc=><label key={doc.id}><input type="checkbox" checked={docIds.includes(doc.id)} onChange={()=>setDocIds(toggle(docIds,doc.id))}/>{doc.name}</label>)}
        <label><input type="checkbox" checked={includeImages} onChange={event=>setIncludeImages(event.target.checked)}/>Include image sources</label>
      </details><IcrSummaryPanel project={project} coders={coders} scope={scope} method={icrMethod} onMessage={onMessage}/></>}
    </fieldset>
    {error&&<p role="alert">{error}</p>}
    <button className="primary-btn" disabled={busy||includeIcr&&!summary.available} onClick={async()=>{setBusy(true);setError('');try{
      const outline=await buildManuscriptOutline(project,{framework,cooccurrence,projectMemos,icrText:includeIcr?summary.text:undefined},cropRegionToPng);
      if(!outline.length){setError('No code summaries, starred excerpts or selected memos are available.');return;}
      const path=await window.qv.exportDocxTable({kind:'outline',manuscript:true,title:project.name+' — Results Skeleton',outline,filenameBase:project.name.replace(/[^\w\- ]/g,'_')+'_results_skeleton'});
      if(path){onMessage('Manuscript skeleton exported to '+path);onClose();}
    }catch(error){setError(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}}>{busy?'Exporting…':'Export manuscript Word'}</button>
  </div></div>;
}
