import React, { useMemo, useState } from 'react';
import { Project } from '../domain';
import { CasePassage, passageCaseIds } from '../lib/passageCases';
import {passagePreview} from '../lib/textPreview';

export default function PassageCasePicker({ project, passage, onSave, onManage, onCancel }: {
  project: Project; passage: CasePassage; onSave: (changes: Record<string, boolean>) => void; onManage: () => void; onCancel: () => void;
}) {
  const [search, setSearch] = useState(''), [localOnly, setLocalOnly] = useState(true);
  const [profile,setProfile]=useState<string|null>(null);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const linked = useMemo(() => new Set(passageCaseIds(project, passage)), [project.cases, passage]);
  const doc = project.docs.find(d => d.id === passage.docId)!;
  const contextStart = Math.max(0, doc.content.lastIndexOf('\n', Math.max(0, passage.start - 1)) + 1);
  const contextEnd = Math.min(doc.content.length, passage.end + 200);
  const speakerPrefix=doc.content.slice(contextStart,passage.start).trim();
  const selectedCount=(project.cases||[]).filter(c=>changes[c.id]??linked.has(c.id)).length;
  const cases = useMemo(() => (project.cases || []).filter(c => (!localOnly || c.links.some(l => l.docId === passage.docId)) &&
    [c.id, c.name, ...Object.entries(c.attributes).flat()].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => Number(b.links.some(l => l.docId === passage.docId)) - Number(a.links.some(l => l.docId === passage.docId)) || a.name.localeCompare(b.name)), [project.cases, passage.docId, search, localOnly]);
  return <div className="passage-case-picker">
    <div className="case-picker-source"><strong>{doc.name}</strong><span>{selectedCount} selected</span></div>
    <blockquote className="case-picker-quote" aria-label="Passage context">{speakerPrefix.length<=50&&speakerPrefix?speakerPrefix+' ':''}<mark>{passagePreview(doc.content.slice(passage.start,passage.end))}</mark></blockquote>
    <details className="case-picker-context"><summary>Full passage & context</summary><p>{doc.content.slice(Math.max(contextStart,passage.start-100),passage.start)}<mark>{doc.content.slice(passage.start,passage.end)}</mark>{doc.content.slice(passage.end,contextEnd)}</p></details>
    <div className="case-picker-search"><input autoFocus className="modal-input" aria-label="Search cases" placeholder="Search name, ID or profile…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="case-picker-scope"><label><input type="checkbox" checked={localOnly} onChange={e=>setLocalOnly(e.target.checked)}/>Only cases linked to this document</label><span>{cases.length} shown</span></div>
    <div className="case-picker-results" role="group" aria-label="Available cases">{cases.map(c=>{
      const attributes=Object.entries(c.attributes),priority=['age','gender','sex','occupation','location'];
      const rank=(key:string)=>{const index=priority.indexOf(key.toLocaleLowerCase());return index<0?priority.length:index;};
      const useful=attributes.filter(([,v])=>v&& !/^(not reported|not verified|unknown)$/i.test(v)).sort(([a],[b])=>rank(a)-rank(b));
      return <div className="case-picker-row" key={c.id}>
        <div className="case-picker-row-heading"><label><input type="checkbox" checked={changes[c.id]??linked.has(c.id)} onChange={e=>setChanges({...changes,[c.id]:e.target.checked})}/><span><strong>{c.name}</strong><small>{useful.slice(0,2).map(([k,v])=>`${k}: ${v}`).join(' · ')||c.kind}</small></span></label><button aria-label={'Profile for '+c.name} aria-expanded={profile===c.id} onClick={()=>setProfile(profile===c.id?null:c.id)}>Profile</button></div>
        {profile===c.id&&<dl className="case-picker-profile">{attributes.map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value||'—'}</dd></div>)}{!attributes.length&&<p>No profile attributes yet.</p>}</dl>}
      </div>;
    })}{!cases.length&&<div className="case-picker-empty"><p>{localOnly?'No matching cases linked to this document.':'No matching cases.'}</p>{localOnly?<p>Uncheck the document filter to include other project cases.</p>:<button onClick={onManage}>Create / manage cases</button>}</div>}</div>
    <p className="case-picker-hint">Applies across all codes on this text. Removing a case keeps its links outside this passage.</p>
    <div className="modal-actions case-picker-footer"><button className="primary-btn" aria-label="Save case assignments" disabled={!Object.keys(changes).length} onClick={()=>onSave(changes)}>Save assignments</button><button onClick={onManage}>Manage / create cases</button><button onClick={onCancel}>Cancel</button></div>
  </div>;
}
