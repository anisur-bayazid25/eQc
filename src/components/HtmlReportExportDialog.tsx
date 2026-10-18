import React,{useEffect,useRef,useState} from 'react';
import {Project} from '../domain';
import {comparisonMethods} from '../lib/icrComparisons';
import type {ReportExtras} from '../lib/report';

export default function HtmlReportExportDialog({project,extras,onExport,onClose}:{project:Project;extras:ReportExtras;onExport:(ids:string[],notes:boolean,progress:(message:string)=>void,icrRunId?:string)=>Promise<boolean>;onClose:()=>void}) {
  const [runId,setRunId]=useState('');
  const drafts=project.mapDrafts||[];
  const [selected,setSelected]=useState(drafts.map(d=>d.id)),[notes,setNotes]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.focus();return()=>previous?.focus();},[]);
  return <div className="research-overlay"><div className="manuscript-dialog" role="dialog" aria-modal="true" aria-label="HTML report options" tabIndex={-1} ref={ref} onKeyDown={event=>{
    if(event.key==='Escape'&&!busy){event.stopPropagation();onClose();}
    if(event.key==='Tab'){const fields=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')||[]),first=fields[0],last=fields[fields.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}>
    <header><h2>HTML report</h2><button disabled={busy} onClick={onClose}>Close report options</button></header>
    <p>One offline report with a contents list, collapsible searchable tables, research records and ICR results.</p>
    <fieldset><legend>ICR results</legend><label>Results source<select aria-label="HTML saved ICR run" value={runId} onChange={e=>setRunId(e.target.value)}><option value="">Current project calculations</option>{project.icrRuns?.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      {runId?<p>The selected saved run supplies its original results, coders, settings and review confirmations. Later coding changes do not alter these statistics.</p>:<><p>Uses the coders and source scope selected in Analysis → ICR{extras.icr?`: ${extras.icr.coders.length} coders and ${extras.icr.scope.docIds.length} text documents${extras.icr.scope.includeImages&&(project.images||[]).length?`, ${(project.images||[]).length} images`:''}`:''}. Includes every selected coder pair and the available multi-coder measures.</p>
      <p>{project.icrComparison?`Additional comparison: ${comparisonMethods[project.icrComparison.method]}. Its saved settings and calculation details are included.`:'No additional comparison is saved. Calculate one in Analysis → ICR to include it.'}</p></>}
    </fieldset>
    <fieldset disabled={busy}><legend>Saved graph drafts ({selected.length} selected)</legend>
      <p>Each selected draft becomes a static figure of its saved canvas. Regenerate a graph in Visualization first if its analysis needs updating.</p>
      {drafts.length?<><div className="research-actions"><button onClick={()=>setSelected(drafts.map(d=>d.id))}>Select all graphs</button><button onClick={()=>setSelected([])}>Clear graph selection</button></div>
        <div className="report-draft-picker">{drafts.map(d=><label key={d.id}><input type="checkbox" checked={selected.includes(d.id)} onChange={()=>setSelected(current=>current.includes(d.id)?current.filter(id=>id!==d.id):[...current,d.id])}/>{d.name}</label>)}</div>
        <label><input type="checkbox" checked={notes} disabled={!selected.length} onChange={event=>setNotes(event.target.checked)}/>Include selected drafts’ visualization notes</label></>:<p>No saved graph drafts yet. Save a draft in Visualization to include it here.</p>}
    </fieldset>
    {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
    <button className="primary-btn" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{if(await onExport(selected,notes,setStatus,runId||undefined))onClose();}catch(error){setError(error instanceof Error?error.message:String(error));}finally{setBusy(false);setStatus('');}}}>{busy?'Preparing report…':'Export HTML report'}</button>
  </div></div>;
}
