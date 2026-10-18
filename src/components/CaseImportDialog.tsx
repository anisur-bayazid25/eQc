import React,{useMemo,useState} from 'react';
import {Project,ResearchCase} from '../domain';
import {previewCaseImport} from '../lib/caseExchange';
export default function CaseImportDialog({project,rows,onApply,onClose}:{project:Project;rows:Record<string,unknown>[];onApply:(cases:ResearchCase[])=>void;onClose:()=>void}) {
  const [mode,setMode]=useState<'update'|'add'>('update');
  const preview=useMemo(()=>{try{return {plan:previewCaseImport(project,rows,mode),error:''};}catch(e){return {plan:null,error:String(e instanceof Error?e.message:e)};}},[project,rows,mode]);
  return <div className="research-overlay" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}><section className="project-export-dialog" role="dialog" aria-modal="true" aria-label="Import cases preview"><h2>Import cases preview</h2>
    <label>Matching cases<select autoFocus value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="update">Update matching Case ID or unique name; add new cases</option><option value="add">Add as separate new cases</option></select></label>
    {preview.error?<p role="alert">{preview.error}</p>:preview.plan&&<><p>{preview.plan.added} added · {preview.plan.updated} updated · {preview.plan.unchanged} unchanged</p><p>Only imported columns change attributes. Source and passage links use the imported Links or Document column.</p><div className="icr-result-scroll">{preview.plan.warnings.map((w,i)=><p key={i}>{w}</p>)}</div></>}
    <div className="research-actions"><button disabled={!preview.plan} onClick={()=>{if(preview.plan)onApply(preview.plan.cases);}}>Apply case import</button><button onClick={onClose}>Cancel</button></div>
  </section></div>;
}
