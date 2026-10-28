import {saveExport} from '../lib/spreadsheetExport';
import {useAnalysisScrollMemory} from '../lib/analysisActivity';
import IconButton,{Icon} from './IconButton';
import MemoLinks,{memoLinkIndex} from './MemoLinks';
import ToolMenu from './ToolMenu';
import CaseImportDialog from './CaseImportDialog';
import {caseTableCsv,validateCaseAttributes} from '../lib/caseExchange';
import CaseAttributesEditor from './CaseAttributesEditor';
import { normalizeCoderName } from '../domain';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import Papa from 'papaparse';
import { mergeMemos, memoExportRows, listMemoRecords, updateMemoText, MemoRecord, memoCategory, memoCategories } from '../lib/memoTools';
import { ActivityEntry, Project, ProjectSnapshot, ResearchCase, ResearchGroup, ResearchMemo, uid } from '../domain';
import TaskTabs from './TaskTabs';
import { emptyQuery, excerptContext, retrieveExcerpts, RetrievedExcerpt, reassignExcerpts, splitCode } from '../lib/research';
import { researchHtml, researchRows, retrievedReport } from '../lib/researchExport';
import { sourceLineRange } from '../lib/sourceLines';
import { buildScopedExport } from '../lib/exportBuilders';
import { cropRegionToPng } from '../lib/imageCrop';

interface Props { active?:boolean; onAssignCase?:(id:string)=>void; onUseResults?:(scope:import('../lib/researchScope').ResearchScopeSelection,family:import('../domain').VisualizationKind)=>void; memoTarget?: {id:string;nonce:number} | null; onMemoTargetHandled?: () => void; onMemoRequestHandled?: () => void; memoRequest?: ResearchMemo | null; onManuscript?: () => Promise<void>; initialCaseId?: string; embedded?: boolean; onMemoSource?: (memo: MemoRecord) => void; project: Project; section: string; onSection: (id: string) => void; onClose: () => void; onChange: (p: Project) => void; onNavigate: (id: string) => void; onAdjust: (id: string) => void; selection?: { docId: string; start: number; end: number } | null; actor?: string; }
function RegionPreview({ project, row }: { project:Project;row:RetrievedExcerpt }) {
  const [src,setSrc]=useState('');
  useEffect(()=>{let cancelled=false;const image=project.images?.find(i=>i.id===row.sourceId);if(image&&row.region)cropRegionToPng(image.dataUrl,row.region).then(p=>{if(!cancelled)setSrc('data:image/png;base64,'+p.base64);}).catch(()=>setSrc(''));return ()=>{cancelled=true;};},[project.images,row.region]);
  return src?<img className="research-region-preview" alt={'Coded region from '+row.sourceName} src={src}/>:<small>Region preview unavailable.</small>;
}
function Picker({ label, items, value, onChange }: { label: string; items: Array<{ id: string; name: string }>; value: string[]; onChange: (ids: string[]) => void }) {
  const [search,setSearch]=useState(''),[open,setOpen]=useState(false),[limit,setLimit]=useState(100);
  const filtered=useMemo(()=>open?items.filter(i=>i.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())):[],[items,search,open]);
  return <details className="research-picker" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{label} <span>{value.length?`${value.length} selected`:'None selected'}</span></summary>{open&&<>
    <input aria-label={`Find ${label}`} placeholder="Find…" value={search} onChange={e=>{setSearch(e.target.value);setLimit(100);}}/>
    <div className="research-picker-list">{filtered.slice(0,limit).map(i=><label key={i.id}><input type="checkbox" checked={value.includes(i.id)} onChange={e=>onChange(e.target.checked?[...value,i.id]:value.filter(id=>id!==i.id))}/>{i.name}</label>)}</div>
    {filtered.length>limit&&<button type="button" onClick={()=>setLimit(n=>n+100)}>Show next 100</button>}<button type="button" onClick={()=>onChange([])}>Clear selection</button></>}</details>;
}
export default function ResearchWorkspace(props: Props) {
  const { project, onChange } = props;
  const root=useRef<HTMLDivElement>(null),active=props.active!==false;
  const rememberScroll=useAnalysisScrollMemory(root,active);
  function openMemoSource(memo:MemoRecord){rememberScroll();props.onMemoSource?.(memo);}
  const linkIndex=useMemo(()=>props.section==='notes'?memoLinkIndex(project):null,[project.docs,project.images,project.codes,project.cases,project.codedSegments,project.codedRegions,props.section]);
  const [expandedNotes,setExpandedNotes]=useState<string[]>([]);
  const [graphFamily,setGraphFamily]=useState<import('../domain').VisualizationKind>('word-cloud');
  const [message, setMessage] = useState(''), [search, setSearch] = useState('');
  const [caseImportRows,setCaseImportRows]=useState<Record<string,unknown>[]|null>(null);
  const [caseDraft, setCaseDraft] = useState<ResearchCase | null>(null);
  useEffect(()=>{const c=project.cases?.find(c=>c.id===props.initialCaseId);if(c){setCaseDraft(structuredClone(c));}},[props.initialCaseId]);
  const [groupDraft, setGroupDraft] = useState<ResearchGroup | null>(null);
  const [memoDraft, setMemoDraft] = useState<ResearchMemo | null>(null);
  useEffect(()=>{if(props.memoRequest){setEmbeddedDraft(null);setMemoDraft(structuredClone(props.memoRequest));props.onMemoRequestHandled?.();requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('.memo-tab-workspace .research-form input')?.focus());}},[props.memoRequest]);
  const [query, setQuery] = useState(emptyQuery), [results, setResults] = useState<RetrievedExcerpt[] | null>(null), [checked, setChecked] = useState<string[]>([]), [targetCode, setTargetCode] = useState(''), [splitName, setSplitName] = useState('');
  const [showContext, setShowContext] = useState(true), [showComparison, setShowComparison] = useState(false);
  const [history, setHistory] = useState<{ activity: ActivityEntry[]; snapshots: ProjectSnapshot[] }>({ activity: [], snapshots: [] }), [checkpointLabel, setCheckpointLabel] = useState(''), [restoreId, setRestoreId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedMemos, setSelectedMemos] = useState<string[]>([]), [mergeTarget, setMergeTarget] = useState('new'), [confirmMerge, setConfirmMerge] = useState(false);
  const [category, setCategory] = useState('all'), [selectedOnly, setSelectedOnly] = useState(false);
  const allMemos = useMemo(() => props.section === 'notes' ? listMemoRecords(project) : [], [project,props.section]);
  const [focusedMemoId,setFocusedMemoId] = useState('');
  useEffect(()=>{if(!props.memoTarget)return;const index=allMemos.findIndex(m=>m.id===props.memoTarget!.id);setCategory('all');setSelectedOnly(false);setSearch('');setMemoPage(Math.max(0,Math.floor(index/20)));setFocusedMemoId(props.memoTarget.id);},[props.memoTarget]);
  const [memoPage,setMemoPage] = useState(0);
  const selectedMemoSet = useMemo(()=>new Set(selectedMemos),[selectedMemos]);
  const visibleMemos = useMemo(()=>allMemos.filter(m => (category === 'all' || memoCategory(m) === category) && (!selectedOnly || selectedMemoSet.has(m.id)) && [m.title,m.text,m.kind,memoCategory(m)].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase())),[allMemos,category,selectedOnly,selectedMemoSet,search]);
  const pageCount=Math.max(1,Math.ceil(visibleMemos.length/20)), currentPage=Math.min(memoPage,pageCount-1);
  const displayedMemos=visibleMemos.slice(currentPage*20,(currentPage+1)*20);
  useEffect(()=>{if(!props.memoTarget)setMemoPage(0);},[category,selectedOnly,search]);
  useEffect(()=>{const target=props.memoTarget;if(!target||!displayedMemos.some(m=>m.id===target.id))return;const frame=requestAnimationFrame(()=>{const card=document.getElementById('memo-record-'+encodeURIComponent(target.id));card?.scrollIntoView({block:'center'});card?.focus({preventScroll:true});props.onMemoTargetHandled?.();});return()=>cancelAnimationFrame(frame);},[props.memoTarget,currentPage,visibleMemos]);
  const [mergedTitle, setMergedTitle] = useState('Merged memo'), [embeddedDraft, setEmbeddedDraft] = useState<MemoRecord | null>(null);
  useEffect(() => { const available=new Set(allMemos.map(m=>m.id));setSelectedMemos(ids => ids.filter(id => available.has(id))); }, [allMemos]);
  async function copyNote(text: string) { await safe(async () => { await navigator.clipboard.writeText(text); setMessage('Memo text copied.'); }); }
  async function exportMemos(format: string, ids: string[]) { await safe(async () => {
    const rows = memoExportRows(project, ids); if (!rows.length) throw new Error('Select a memo to export.');
    const name = project.name + '_' + (rows.length === 1 ? rows[0].Title : 'Selected memos');
    const categories = Array.from(new Set(Object.values(memoCategories)));
    const sheets = categories.map(name => { const values = rows.filter(r => r.Category === name); return {name, headers:Object.keys(rows[0]), rows:values.map(r => Object.values(r))}; });
    const saved = format === 'xlsx' ? await window.qv.exportMemoWorkbook({filenameBase:name,sheets}) : await window.qv.exportDocxTable({kind:'outline', title:'Memos', filenameBase:name, outline:categories.flatMap(category => {const group=rows.filter(row=>row.Category===category);return group.length?[{name:category,depth:0},...group.map(row => ({name:row.Title, depth:1, summary:Object.entries(row).filter(([key]) => key !== 'Title').map(([key,value]) => key + ': ' + value).join('\n')}))]:[];})});
    if(saved) setMessage('Memos exported.');
  }); }
  const titleId = 'research-workspace-title';
  const filtered = <T extends { name?: string; title?: string }>(items: T[]) => items.filter(i => (i.name || i.title || '').toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const notify = (e: unknown) => { const text = e instanceof Error ? e.message : String(e); setMessage(/No handler registered.*projects:/.test(text) ? 'Save your project, then fully close and restart eQc to load History and recovery tools. Reloading the document view is not enough.' : text); };
  async function safe(task: () => Promise<void>) { setBusy(true); setMessage(''); try { await task(); } catch (e) { notify(e); } finally { setBusy(false); } }
  useEffect(() => {
    if (props.embedded) return;
    const previous = document.activeElement as HTMLElement | null;
    document.getElementById(titleId)?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
      if (e.key === 'Tab') {
        const modal = document.querySelector('.research-workspace');
        const focusable = Array.from(modal?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, summary, [tabindex="0"]') || []).filter(el => el.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, []);
  useEffect(() => { setSearch(''); setMessage(''); }, [props.section]);
  useEffect(() => { setResults(null);setChecked([]); }, [query]);
  useEffect(() => { if (results) { setResults(retrieveExcerpts(project, query)); setChecked(ids => ids.filter(id => project.codedSegments.some(s => s.id === id) || project.codedRegions?.some(r => r.id === id))); } }, [project]);
  useEffect(() => { if (props.section === 'history') safe(async () => setHistory(await window.qv.projectHistory(project.id))); }, [props.section]);
  const codeNames = useMemo(() => new Map(project.codes.map(c => [c.id, c.name])), [project.codes]);
  async function exportRecords(format: string) {
    await safe(async () => {
      if (format === 'xlsx') {
        const rows=researchRows(project);
        await window.qv.exportMemoWorkbook({title:'Export project data to Excel',filenameBase:`${project.name}_Project data`,sheets:[{name:'Project data',headers:rows[0],rows:rows.slice(1)}]});
      }
      if (format === 'html') await saveExport({ title:'Export project data',defaultName:`${project.name}_Project data.html`,content:`<!doctype html><meta charset="utf-8"><title>Project data</title>${researchHtml(project).replace('<h2>Research records</h2>','<h2>Project data</h2>')}`,extension:'html',filterName:'HTML' });
      if (format === 'docx') {
        const rows = researchRows(project).slice(1);
        await window.qv.exportDocxTable({ kind:'outline',title:'Project data',filenameBase:`${project.name}_Project data`,outline:rows.map(r=>({name:`${r[0]} — ${r[1]}`,depth:0,summary:[r[2]&&`Document: ${r[2]}`,r[3]&&`Code: ${r[3]}`,r[4]&&`Case: ${r[4]}`,r[5]&&`Location: ${r[5]}`,r[6],r[7]&&`Created: ${r[7]}`,r[8]&&`Updated: ${r[8]}`].filter(Boolean).join('\n')})) });
      }
      setMessage('Export completed or cancelled.');
    });
  }
  async function exportResults(format: string) {
    await safe(async () => {
      const rows = checked.length ? (results || []).filter(r => checked.includes(r.id)) : results || [];
      if (!rows.length) throw new Error('Run a query that retrieves at least one excerpt.');
      const ids = new Set(rows.map(r => r.id));
      const scoped = { ...project, codedSegments:project.codedSegments.filter(s=>ids.has(s.id)),codedRegions:project.codedRegions?.filter(r=>ids.has(r.id)) };
      if (format === 'xlsx') {
        const data = buildScopedExport(scoped,'codesExcerptsSummaries',new Set(rows.map(r=>r.codeId)));
        await saveExport({title:'Export retrieved excerpts',defaultName:`${project.name}_${query.name || 'Retrieved excerpts'}.xlsx`,content:data.csv,extension:'xlsx',filterName:'Excel workbook'});
      } else {
        const report = retrievedReport(project,rows,query.name || 'Retrieved excerpts');
        for (const source of report.sources) for(const code of source.codes) for(const excerpt of code.excerpts) if(excerpt.region) {
          const image=project.images?.find(i=>i.id===excerpt.region!.imageId);if(image)excerpt.image=await cropRegionToPng(image.dataUrl,excerpt.region);
        }
        await window.qv.exportDocxTable(report);
      }
    });
  }
  const sections=[{id:'cases',label:'Cases'},{id:'groups',label:'Groups'},{id:'review',label:'Review'},{id:'history',label:'History'}];
  const currentRows=results || [];
  const memoExcerptItems=useMemo(()=>memoDraft?[...project.codedSegments.map(s=>({id:s.id,name:`${linkIndex?.docs.get(s.docId)?.name}: ${s.text.slice(0,65)}`})),...(project.codedRegions||[]).map(r=>({id:r.id,name:'Image: '+linkIndex?.images.get(r.imageId)?.name+' — '+codeNames.get(r.codeId)}))]:[],[!!memoDraft,project.codedSegments,project.codedRegions,linkIndex,codeNames]);
  const memoEditor = memoDraft&&<form className="research-form" onSubmit={e=>{e.preventDefault();if(!memoDraft.title.trim())return;onChange({...project,memos:[...(project.memos||[]).filter(m=>m.id!==memoDraft.id),{...memoDraft,title:memoDraft.title.trim(),updatedAt:Date.now()}]});setMemoDraft(null);setMessage('Memo saved.');}}><label>Title<input autoFocus required value={memoDraft.title} onChange={e=>setMemoDraft({...memoDraft,title:e.target.value})}/></label><label>Purpose<select value={memoDraft.kind} onChange={e=>setMemoDraft({...memoDraft,kind:e.target.value as ResearchMemo['kind']})}><option value="analytic">Analytic memo</option><option value="methodological">Methodological memo</option><option value="journal">Research journal</option></select></label><label>Memo<textarea aria-label="Memo" rows={7} value={memoDraft.text} onChange={e=>setMemoDraft({...memoDraft,text:e.target.value})}/></label><div className="research-query-grid"><Picker label="Linked documents" items={[...project.docs,...(project.images||[])]} value={memoDraft.docIds} onChange={ids=>setMemoDraft({...memoDraft,docIds:ids})}/><Picker label="Linked codes" items={project.codes} value={memoDraft.codeIds} onChange={ids=>setMemoDraft({...memoDraft,codeIds:ids})}/><Picker label="Linked cases" items={project.cases||[]} value={memoDraft.caseIds} onChange={ids=>setMemoDraft({...memoDraft,caseIds:ids})}/><Picker label="Linked excerpts" items={memoExcerptItems} value={memoDraft.segmentIds} onChange={ids=>setMemoDraft({...memoDraft,segmentIds:ids})}/></div><div className="research-actions"><IconButton icon="save" label="Save memo" type="submit" className="primary-btn"/><IconButton icon="close" label="Cancel" type="button" onClick={()=>setMemoDraft(null)}/><button type="button" onClick={()=>{onChange({...project,memos:project.memos?.filter(m=>m.id!==memoDraft.id)});setMemoDraft(null);}}>Remove memo</button></div></form>;
  const attachedEditor = embeddedDraft&&<form className="research-form" onSubmit={e=>{e.preventDefault();onChange(updateMemoText(project,embeddedDraft,embeddedDraft.text));setEmbeddedDraft(null);setMessage(embeddedDraft.origin.kind==='annotation'&&!embeddedDraft.text.trim()?'Annotation deleted.':'Memo saved.');}}><h3>{embeddedDraft.title}</h3><label>Memo<textarea autoFocus aria-label="Memo" rows={7} value={embeddedDraft.text} onChange={e=>setEmbeddedDraft({...embeddedDraft,text:e.target.value})}/></label><IconButton icon="save" label="Save memo" type="submit"/>{embeddedDraft.origin.kind==='annotation'&&<button type="button" onClick={()=>{onChange(updateMemoText(project,embeddedDraft,''));setEmbeddedDraft(null);setMessage('Annotation deleted.');}}>Delete annotation</button>}<IconButton icon="close" label="Cancel" type="button" onClick={()=>setEmbeddedDraft(null)}/></form>;

  const memoExportMenu=<ToolMenu label="Export" icon="download">
    <section className="export-menu-section" aria-label="All memos and notes"><strong>All memos & notes</strong><div className="export-format-actions">
      <button aria-label="Export all Excel" disabled={busy||!allMemos.length} onClick={()=>exportMemos('xlsx',allMemos.map(m=>m.id))}><Icon name="sheet"/>Excel</button>
      <button aria-label="Export all Word" disabled={busy||!allMemos.length} onClick={()=>exportMemos('docx',allMemos.map(m=>m.id))}><Icon name="word"/>Word</button>

    </div></section>
    <section className="export-menu-section" aria-label="Selected memos"><strong>Selected memos ({selectedMemos.length})</strong><div className="export-format-actions">
      <button aria-label="Selected memos Excel" disabled={busy||!selectedMemos.length} onClick={()=>exportMemos('xlsx',selectedMemos)}><Icon name="sheet"/>Excel</button>
      <button aria-label="Selected memos Word" disabled={busy||!selectedMemos.length} onClick={()=>exportMemos('docx',selectedMemos)}><Icon name="word"/>Word</button>

    </div></section>
    <details className="export-more"><summary>More exports</summary><section className="export-menu-section" aria-label="Project data"><strong>Project data</strong><small>Participant profiles, case links, groups, queries and notes</small><div className="export-format-actions">
      <button aria-label="Project data Excel" disabled={busy} onClick={()=>exportRecords('xlsx')}><Icon name="sheet"/>Excel</button><button aria-label="Project data Word" disabled={busy} onClick={()=>exportRecords('docx')}><Icon name="word"/>Word</button><button aria-label="Project data HTML" disabled={busy} onClick={()=>exportRecords('html')}>HTML</button>
    </div></section></details>
    {props.onManuscript&&<section className="export-menu-section"><button aria-label="Manuscript skeleton Word" disabled={busy} onClick={()=>safe(async()=>{await props.onManuscript?.();})}><Icon name="word"/>Manuscript skeleton</button></section>}
  </ToolMenu>;
  return <div ref={root} onScrollCapture={rememberScroll} style={{display:active?undefined:'none'}} className={props.embedded ? "memo-tab-container" : "research-overlay"} onMouseDown={e=>{if(e.target===e.currentTarget)props.onClose();}}>
    <section className={"research-workspace" + (props.embedded ? " memo-tab-workspace" : "")} role={props.embedded ? "region" : "dialog"} aria-modal={props.embedded ? undefined : true} aria-labelledby={titleId}>
      <header><h2 id={titleId} tabIndex={-1}>{props.embedded ? "Memo-Book" : "Research tools"}</h2>{props.section==='notes'&&<div className="research-actions memo-primary-toolbar"><IconButton icon="plus" label="New memo" onClick={()=>{setEmbeddedDraft(null);setMemoDraft({id:uid('memo'),title:'',text:'',kind:'analytic',docIds:[],codeIds:[],caseIds:[],segmentIds:[],createdAt:Date.now(),updatedAt:Date.now()});}}/><input aria-label="Find notes" placeholder="Search all notes…" value={search} onChange={e=>setSearch(e.target.value)}/><label>Source<select aria-label="Memo source" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All memos and notes</option>{Array.from(new Set(Object.values(memoCategories))).map(c=><option key={c}>{c}</option>)}</select></label><label><input type="checkbox" aria-label="Show selected memos only" checked={selectedOnly} onChange={e=>setSelectedOnly(e.target.checked)}/>Selected</label><span className="memo-count">{visibleMemos.length} / {allMemos.length}</span>{memoExportMenu}</div>}<IconButton icon="close" onClick={props.onClose} label="Close research tools"/></header>
      {!props.embedded && <TaskTabs label="Research sections" active={props.section} options={sections} onChange={props.onSection}/>}
      <div className="research-content" id={`task-panel-${props.section}`} role={props.embedded ? undefined : "tabpanel"} aria-labelledby={props.embedded ? undefined : `task-tab-${props.section}`}>
        {message&&<p className="research-message" role="status">{message}</p>}
        {props.section==='cases'&&<>
          <p className="section-hint">Describe participants, organisations or places. A case can span sources or selected passages in an FGD.</p>
          <div className="research-actions"><button onClick={()=>{setCaseDraft({id:uid('case'),name:'',kind:'person',attributes:{},links:[]});}}>New case</button><button disabled={busy} onClick={()=>safe(async()=>{
            const data=await window.qv.pickAndParseCsv();if(!data)return;
            setCaseImportRows(data.rows as Record<string,unknown>[]);
          })}>Import cases</button><button onClick={()=>safe(async()=>{await saveExport({title:'Export cases Excel',defaultName:project.name+'_Cases.xlsx',content:caseTableCsv(project),extension:'xlsx',filterName:'Excel workbook'});})}>Export cases Excel</button><span className="section-hint">Columns: Case, Document, then attributes</span></div>
          <div className="research-layout"><div className="research-list"><input aria-label="Find cases" placeholder="Find cases…" value={search} onChange={e=>setSearch(e.target.value)}/>{filtered(project.cases||[]).map(c=><button className={c.id===caseDraft?.id?'active':''} key={c.id} onClick={()=>{setCaseDraft(structuredClone(c));}}>{c.name}<small>{c.links.length} source/passage links</small></button>)}</div>
            {caseDraft?<form className="research-form" onSubmit={e=>{e.preventDefault();if(!caseDraft.name.trim())return;try{validateCaseAttributes(caseDraft);}catch(error){setMessage(String(error));return;}const next={...caseDraft,name:caseDraft.name.trim(),attributes:Object.fromEntries(Object.entries(caseDraft.attributes).filter(([,value])=>value.trim()))};onChange({...project,cases:[...(project.cases||[]).filter(c=>c.id!==next.id),next]});setCaseDraft(next);setMessage('Case saved.');}}>
              <label>Name<input required value={caseDraft.name} onChange={e=>setCaseDraft({...caseDraft,name:e.target.value})}/></label>
              <label>Case type<select value={caseDraft.kind} onChange={e=>setCaseDraft({...caseDraft,kind:e.target.value as ResearchCase['kind']})}><option value="person">Person</option><option value="organisation">Organisation</option><option value="place">Place</option><option value="other">Other</option></select></label>
              <CaseAttributesEditor key={caseDraft.id} value={caseDraft.attributes} types={caseDraft.attributeTypes} onTypesChange={attributeTypes=>setCaseDraft({...caseDraft,attributeTypes})} onChange={attributes=>setCaseDraft({...caseDraft,attributes})}/>
              <Picker label="Whole sources" items={[...project.docs,...(project.images||[])]} value={caseDraft.links.filter(l=>l.start===undefined).map(l=>l.docId)} onChange={ids=>setCaseDraft({...caseDraft,links:[...caseDraft.links.filter(l=>l.start!==undefined),...ids.map(docId=>({docId}))]})}/>
              {props.selection&&<button type="button" onClick={()=>{const s=props.selection!;setCaseDraft({...caseDraft,links:[...caseDraft.links.filter(l=>!(l.docId===s.docId&&l.start===s.start&&l.end===s.end)),s]});}}>Link selected passage to this case</button>}
              {caseDraft.links.filter(l=>l.start!==undefined).map((l,index)=><div className="research-link" key={index}>{project.docs.find(d=>d.id===l.docId)?.name} · {sourceLineRange(project.docs.find(d=>d.id===l.docId)?.content||'',l.start!,l.end!)}<details><summary>Read linked passage</summary><blockquote style={{whiteSpace:'pre-wrap'}}>{project.docs.find(d=>d.id===l.docId)?.content.slice(l.start,l.end)}</blockquote></details><button type="button" onClick={()=>setCaseDraft({...caseDraft,links:caseDraft.links.filter(link=>link!==l)})}>Unlink</button></div>)}
              <label>Case memo<textarea value={caseDraft.notes||''} onChange={e=>setCaseDraft({...caseDraft,notes:e.target.value})}/></label>
              <div className="research-actions"><button className="primary-btn" type="submit">Save case</button><button type="button" onClick={()=>{onChange({...project,cases:project.cases?.filter(c=>c.id!==caseDraft.id)});setCaseDraft(null);}}>Remove case</button></div>
            </form>:<p className="empty-hint">Create or select a case.</p>}</div>
        </>}
        {props.section==='groups'&&<>
          <p className="section-hint">Groups provide reusable selections. An item can belong to several groups without changing folders or code hierarchy.</p>
          <button onClick={()=>setGroupDraft({id:uid('group'),name:'',kind:'documents',memberIds:[]})}>New group</button>
          <div className="research-layout"><div className="research-list"><input aria-label="Find groups" placeholder="Find groups…" value={search} onChange={e=>setSearch(e.target.value)}/>{filtered(project.groups||[]).map(g=><button key={g.id} onClick={()=>setGroupDraft(structuredClone(g))}>{g.name}<small>{g.kind} · {g.memberIds.length} members</small></button>)}</div>
            {groupDraft?<form className="research-form" onSubmit={e=>{e.preventDefault();if(!groupDraft.name.trim())return;onChange({...project,groups:[...(project.groups||[]).filter(g=>g.id!==groupDraft.id),{...groupDraft,name:groupDraft.name.trim()}]});setMessage('Group saved.');}}>
              <label>Name<input required value={groupDraft.name} onChange={e=>setGroupDraft({...groupDraft,name:e.target.value})}/></label><label>Items<select value={groupDraft.kind} onChange={e=>setGroupDraft({...groupDraft,kind:e.target.value as ResearchGroup['kind'],memberIds:[]})}><option value="documents">Documents and images</option><option value="codes">Codes</option></select></label>
              <Picker label="Group members" items={groupDraft.kind==='codes'?project.codes:[...project.docs,...(project.images||[])]} value={groupDraft.memberIds} onChange={ids=>setGroupDraft({...groupDraft,memberIds:ids})}/>
              <div className="research-actions"><button type="submit" className="primary-btn">Save group</button><button type="button" onClick={()=>{onChange({...project,groups:project.groups?.filter(g=>g.id!==groupDraft.id)});setGroupDraft(null);}}>Remove group</button></div>
            </form>:<p className="empty-hint">Create or select a group.</p>}</div>
        </>}
        {props.section==='review'&&<>
          <p className="section-hint">Choose a code or source, then Run query to read its excerpts. Leave selections empty to review all coding. Use the checkboxes only when exporting or refining a subset.</p>
          <div className="research-actions"><label>Saved query<select aria-label="Saved query" value={project.queries?.some(q=>q.id===query.id)?query.id:''} onChange={e=>{const saved=project.queries?.find(q=>q.id===e.target.value);setQuery(saved?structuredClone(saved):emptyQuery());setResults(null);setChecked([]);}}><option value="">New query</option>{project.queries?.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}</select></label><button onClick={()=>{setQuery(emptyQuery());setResults(null);setChecked([]);}}>Reset</button></div>
          <details className="research-query" open={!results}><summary>Query and scope</summary><div className="research-query-grid">
            {query.needsScopeReview && <div role="alert"><p>Some saved filters could not be imported. Review the remaining filters before running this query.</p><button onClick={()=>{setQuery({...query,needsScopeReview:undefined});setResults(null);setChecked([]);}}>Use reviewed filters</button></div>}
            <Picker label="Query codes" items={project.codes} value={query.codeIds} onChange={ids=>setQuery({...query,codeIds:ids})}/><Picker label="Sources" items={[...project.docs,...(project.images||[])]} value={query.docIds} onChange={ids=>setQuery({...query,docIds:ids})}/><label>Find in excerpts or notes<input value={query.text} onChange={e=>setQuery({...query,text:e.target.value})}/></label>
            <details className="research-advanced"><summary>Advanced filters and combined queries</summary><div className="research-query-grid">            <label>Combine codes<select aria-label="Query operator" value={query.operator} onChange={e=>setQuery({...query,operator:e.target.value as typeof query.operator})}><option value="any">Any selected code (OR)</option><option value="all">All selected codes in source (AND)</option><option value="without">Selected codes, excluding sources with B</option><option value="overlap">Selected codes overlap</option><option value="near">Selected codes occur nearby</option></select></label>
            <Picker label="Code groups" items={(project.groups||[]).filter(g=>g.kind==='codes')} value={query.codeGroupIds} onChange={ids=>setQuery({...query,codeGroupIds:ids})}/>
            {query.operator==='without'&&<Picker label="Excluded codes B" items={project.codes} value={query.excludeCodeIds} onChange={ids=>setQuery({...query,excludeCodeIds:ids})}/>}
            {query.operator==='near'&&<label>Maximum gap (characters)<input type="number" min="0" max="100000" value={query.distance} onChange={e=>setQuery({...query,distance:Math.max(0,Number(e.target.value))})}/></label>}
            <Picker label="Document groups" items={(project.groups||[]).filter(g=>g.kind==='documents')} value={query.documentGroupIds} onChange={ids=>setQuery({...query,documentGroupIds:ids})}/><Picker label="Cases" items={project.cases||[]} value={query.caseIds} onChange={ids=>setQuery({...query,caseIds:ids})}/>
            <label>Coder<select value={query.coder} onChange={e=>setQuery({...query,coder:e.target.value})}><option value="">All coders</option>{Array.from(new Set([...project.codedSegments,...(project.codedRegions||[])].map(s=>normalizeCoderName(s.coder)))).sort().map(c=><option key={c}>{c}</option>)}</select></label>

            <label><input type="checkbox" checked={query.descendants} onChange={e=>setQuery({...query,descendants:e.target.checked})}/>Include child codes</label><label><input type="checkbox" checked={query.starredOnly} onChange={e=>setQuery({...query,starredOnly:e.target.checked})}/>Key excerpts only</label>
            <details><summary>Case attribute filter</summary><label>Attribute<input list="research-attributes" value={query.attribute?.name||''} onChange={e=>setQuery({...query,attribute:{name:e.target.value,operator:query.attribute?.operator||'equals',value:query.attribute?.value||''}})}/></label><datalist id="research-attributes">{Array.from(new Set(project.cases?.flatMap(c=>Object.keys(c.attributes)))).map(k=><option key={k}>{k}</option>)}</datalist><select aria-label="Attribute comparison" value={query.attribute?.operator||'equals'} onChange={e=>setQuery({...query,attribute:{name:query.attribute?.name||'',value:query.attribute?.value||'',operator:e.target.value as 'equals'}})}><option value="equals">Equals</option><option value="contains">Contains</option><option value="gt">Greater than (number)</option><option value="lt">Less than (number)</option></select><input aria-label="Attribute value" value={query.attribute?.value||''} onChange={e=>setQuery({...query,attribute:{name:query.attribute?.name||'',operator:query.attribute?.operator||'equals',value:e.target.value}})}/></details>
</div></details>
          </div><p className="section-hint">Scope is applied before code combinations. AND/WITHOUT use the same source; overlap uses intersecting text or image areas. Nearby applies to text only. Empty code selection retrieves all codes.</p></details>
          <div className="research-actions"><button className="primary-btn" disabled={query.needsScopeReview} onClick={()=>{setResults(retrieveExcerpts(project,query));setChecked([]);}}>Run query</button><input aria-label="Query name" placeholder="Name to save this query" value={query.name} onChange={e=>setQuery({...query,name:e.target.value})}/><button disabled={!query.name.trim()} onClick={()=>{onChange({...project,queries:[...(project.queries||[]).filter(q=>q.id!==query.id),{...query,name:query.name.trim()}]});setMessage('Query saved; results are recomputed from current coding.');}}>Save query</button>{project.queries?.some(q=>q.id===query.id)&&<button onClick={()=>onChange({...project,queries:project.queries?.filter(q=>q.id!==query.id)})}>Remove query</button>}</div>
          {results&&<><div className="research-actions"><strong>{results.length} coding entries · {new Set(results.map(r=>r.sourceId)).size} sources</strong><label><input type="checkbox" checked={showContext} onChange={e=>setShowContext(e.target.checked)}/>Surrounding text</label><label><input type="checkbox" checked={showComparison} onChange={e=>setShowComparison(e.target.checked)}/>Compare cases</label><button disabled={busy} onClick={()=>exportResults('xlsx')}>Export results Excel</button><button disabled={busy} onClick={()=>exportResults('docx')}>Export results Word</button>{props.onUseResults&&<><select aria-label="Graph for research results" value={graphFamily} onChange={e=>setGraphFamily(e.target.value as typeof graphFamily)}><option value="word-cloud">Word cloud</option><option value="cooccurrence-network">Co-occurrence network</option><option value="sankey">Sankey</option><option value="heat-map">Heat map</option></select><button disabled={!results.length} onClick={()=>{props.onUseResults?.({label:query.name||'Retrieved excerpts',excerptIds:(checked.length?results.filter(r=>checked.includes(r.id)):results).map(r=>r.id)},graphFamily);props.onClose();}}>Use results in graph</button></>}</div>
            {showComparison&&<div className="research-table-wrap"><table><thead><tr><th>Case</th><th>Attributes</th>{Array.from(new Set(results.map(r=>r.codeId))).map(id=><th key={id}>{codeNames.get(id)}</th>)}</tr></thead><tbody>{(project.cases||[]).map(c=><tr key={c.id}><td>{c.name}</td><td>{Object.entries(c.attributes).map(([k,v])=>`${k}: ${v}`).join('; ')}</td>{Array.from(new Set(results.map(r=>r.codeId))).map(id=><td key={id}>{results.filter(r=>r.caseIds.includes(c.id)&&r.codeId===id).length}</td>)}</tr>)}</tbody></table><small>Counts are coding entries; passages linked to more than one case contribute to each linked case.</small></div>}
            <details className="research-bulk"><summary>Refine selected coding ({checked.length})</summary><p className="section-hint">Check excerpts below. Reassign moves their coding to an existing code. Split moves excerpts from one code to a new sibling code. Notes and coder details stay with each excerpt. To change a text boundary, use Adjust passage on its card. Undo is available after closing Research tools.</p><button onClick={()=>setChecked(checked.length===currentRows.length?[]:currentRows.map(r=>r.id))}>Select / clear all results</button><select aria-label="Reassign to code" value={targetCode} onChange={e=>setTargetCode(e.target.value)}><option value="">Choose destination code</option>{project.codes.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select><button disabled={!checked.length||!targetCode} onClick={()=>{try{onChange(reassignExcerpts(project,checked,targetCode));setChecked([]);setMessage('Selected coding reassigned.');}catch(e){notify(e);}}}>Reassign coding</button><input aria-label="Split code name" placeholder="New code name for selected excerpts" value={splitName} onChange={e=>setSplitName(e.target.value)}/><button disabled={!checked.length||!splitName.trim()} onClick={()=>{try{const selected=currentRows.filter(r=>checked.includes(r.id));if(new Set(selected.map(r=>r.codeId)).size!==1)throw new Error('To split a code, select excerpts from one code.');onChange(splitCode(project,selected[0].codeId,checked,splitName));setChecked([]);setSplitName('');setMessage('New sibling code created; selected coding moved.');}catch(e){notify(e);}}}>Split into new code</button></details>
            <div className="research-results">{currentRows.map(row=>{const context=excerptContext(project,row);return <article key={row.id} className="research-result"><header><label><input aria-label={`Select excerpt ${row.id}`} type="checkbox" checked={checked.includes(row.id)} onChange={e=>setChecked(e.target.checked?[...checked,row.id]:checked.filter(id=>id!==row.id))}/><strong>{codeNames.get(row.codeId)}</strong></label><span>{row.sourceName} · {row.coder}{row.segment&&` · ${sourceLineRange(project.docs.find(d=>d.id===row.sourceId)?.content||'',row.segment.start,row.segment.end)}`}</span></header>{row.region?<p>Image region ({Math.round(row.region.width*100)}% × {Math.round(row.region.height*100)}% of source)<RegionPreview project={project} row={row}/></p>:<p className="research-context">{showContext&&<span>{context.before}</span>}<mark>{context.text}</mark>{showContext&&<span>{context.after}</span>}</p>}{(row.segment?.note||row.region?.note)&&<p>Memo: {row.segment?.note||row.region?.note}</p>}<footer><button onClick={()=>{props.onNavigate(row.id);props.onClose();}}>Open source</button>{row.segment&&props.onAssignCase&&<button onClick={()=>{props.onAssignCase!(row.id);props.onClose();}}>Assign cases</button>}{row.segment&&<button onClick={()=>{props.onAdjust(row.id);props.onClose();}}>Adjust passage</button>}</footer></article>;})}</div>
          </>}
        </>}
        {props.section==='notes'&&<>

          <details className="memo-bulk"><summary>Selection & merge ({selectedMemos.length})</summary><div className="research-actions"><button onClick={()=>setSelectedMemos(Array.from(new Set([...selectedMemos,...visibleMemos.map(m=>m.id)])))}>Select matching memos</button><button onClick={()=>{setSelectedMemos([]);setConfirmMerge(false);}}>Clear selection</button></div><label>Merge into<select aria-label="Destination memo" value={mergeTarget} onChange={e=>{setMergeTarget(e.target.value);setConfirmMerge(false);}}><option value="new">New combined memo</option>{(project.memos||[]).filter(m=>selectedMemos.includes(m.id)).map(m=><option key={m.id} value={m.id}>{m.title}</option>)}</select></label>{mergeTarget==='new'&&<label>Combined memo title<input aria-label="Combined memo title" value={mergedTitle} onChange={e=>setMergedTitle(e.target.value)}/></label>}<button disabled={selectedMemos.length<2||(mergeTarget!=='new'&&!selectedMemos.includes(mergeTarget))} onClick={()=>setConfirmMerge(true)}>Merge selected memos…</button>{confirmMerge&&<div className="research-confirm"><p>Combine selected memo texts and links? Standalone memos will be consolidated into the destination. Selected attached memo fields will be cleared; their codes, sources and excerpts stay in place. Selected passage annotations are removed. Undo can restore the original memos.</p><button onClick={()=>{try{onChange(mergeMemos(project,selectedMemos,mergeTarget,mergedTitle));setSelectedMemos([]);setConfirmMerge(false);setMessage('Memos merged; texts and links retained.');}catch(e){notify(e);}}}>Confirm memo merge</button><button onClick={()=>setConfirmMerge(false)}>Cancel merge</button></div>}</details>
          {memoDraft&&!project.memos?.some(m=>m.id===memoDraft.id)&&memoEditor}
          <nav className="research-actions" aria-label="Memo pages"><IconButton icon="previous" label="Previous memos" disabled={currentPage===0} onClick={()=>setMemoPage(currentPage-1)}/><span>Page {currentPage+1} of {pageCount} · {visibleMemos.length} matching memos</span><IconButton icon="next" label="Next memos" disabled={currentPage>=pageCount-1} onClick={()=>setMemoPage(currentPage+1)}/></nav><div className="research-notes-list">{displayedMemos.map(m=><article key={m.id} id={'memo-record-'+encodeURIComponent(m.id)} tabIndex={-1} className={focusedMemoId===m.id?'memo-focused':undefined}><header><label><input type="checkbox" aria-label={'Select memo '+m.title} checked={selectedMemoSet.has(m.id)} onChange={e=>{setSelectedMemos(e.target.checked?[...selectedMemos,m.id]:selectedMemos.filter(id=>id!==m.id));setConfirmMerge(false);}}/><strong>{m.title}</strong></label><small>{memoCategory(m)} · {m.kind}{m.updatedAt ? ' · '+new Date(m.updatedAt).toLocaleString() : ''}</small></header><p className={expandedNotes.includes(m.id)?'memo-card-text is-expanded':'memo-card-text'}>{m.text || 'Empty annotation. Edit it or delete it.'}</p>{m.text.length>280&&<button className="memo-read-more" onClick={()=>setExpandedNotes(ids=>ids.includes(m.id)?ids.filter(id=>id!==m.id):[...ids,m.id])}>{expandedNotes.includes(m.id)?'Show less':'Read full memo'}</button>}{memoDraft?.id===m.id&&memoEditor}{embeddedDraft?.id===m.id&&attachedEditor}<IconButton icon="edit" label="Edit memo" onClick={()=>{setMemoDraft(null);setEmbeddedDraft(null);m.origin.kind==='standalone'?setMemoDraft(structuredClone(m)):setEmbeddedDraft(structuredClone(m));}}/>{m.origin.kind==='annotation'&&embeddedDraft?.id!==m.id&&<button onClick={()=>{onChange(updateMemoText(project,m,''));setMessage('Annotation deleted.');}}>Delete annotation</button>}<IconButton icon="copy" label="Copy memo text" onClick={()=>copyNote(m.text)}/><IconButton icon="word" label="Export memo Word" disabled={busy} onClick={()=>exportMemos('docx',[m.id])}/><IconButton icon="sheet" label="Export memo Excel" disabled={busy} onClick={()=>exportMemos('xlsx',[m.id])}/>{props.onMemoSource&&m.origin.kind!=='standalone'&&<IconButton icon="open" label="Go to source" onClick={()=>openMemoSource(m)}/>}{props.onMemoSource&&linkIndex&&<MemoLinks memo={m} index={linkIndex} onOpen={openMemoSource}/>}</article>)}{!visibleMemos.length&&<p className="empty-hint">No memos match this view. Create a memo or adjust the filters.</p>}</div>

        </>}
        {props.section==='history'&&<>
          <p className="section-hint">Local activity survives closing the app. Up to ten automatic recovery points rotate at ten-minute intervals when content changes. Named checkpoints are retained until the project is deleted. History belongs to this computer; JSON backups carry research records, not this local recovery database.</p>
          <div className="research-actions"><input aria-label="Checkpoint label" placeholder="Name this recovery point" value={checkpointLabel} onChange={e=>setCheckpointLabel(e.target.value)}/><button disabled={busy||!checkpointLabel.trim()} onClick={()=>safe(async()=>{await window.qv.saveProject(project);setHistory(await window.qv.createCheckpoint(project.id,checkpointLabel.trim()));setCheckpointLabel('');setMessage('Recovery point saved.');})}>Create checkpoint</button><button disabled={busy} onClick={()=>safe(async()=>setHistory(await window.qv.projectHistory(project.id)))}>Refresh history</button><button disabled={busy} onClick={()=>safe(async()=>{await saveExport({title:'Export activity history',defaultName:`${project.name}_Activity history.xlsx`,content:Papa.unparse(history.activity.map(a=>({Time:new Date(a.at).toISOString(),Actor:a.actor,Activity:a.summary}))),extension:'xlsx',filterName:'Excel workbook'});})}>Export activity Excel</button></div>
          <details open><summary>Recovery points ({history.snapshots.length})</summary>{history.snapshots.map(s=><div className="research-link" key={s.id}><span>{s.label} · {new Date(s.at).toLocaleString()} · {(s.sizeBytes/1048576).toFixed(1)} MB</span><button onClick={()=>setRestoreId(s.id)}>Restore…</button></div>)}</details>
          {restoreId!==null&&<div className="research-confirm"><p>Restore this recovery point? Current work will first be saved as a named checkpoint.</p><button disabled={busy} onClick={()=>safe(async()=>{await window.qv.saveProject(project);await window.qv.createCheckpoint(project.id,'Before recovery');const recovered=await window.qv.readSnapshot(project.id,restoreId);await window.qv.saveProject({...recovered,id:project.id},{actor:props.actor,action:'Recovery point restored'});onChange({...recovered,id:project.id});setRestoreId(null);setMessage('Recovery point restored.');setHistory(await window.qv.projectHistory(project.id));})}>Restore project</button><button onClick={()=>setRestoreId(null)}>Cancel</button></div>}
          <details open><summary>Activity ({history.activity.length})</summary><div className="research-history-list">{history.activity.map(a=><div key={a.id}><time>{new Date(a.at).toLocaleString()}</time><strong>{a.actor}</strong><span>{a.summary}</span></div>)}</div></details>
        </>}
      </div>
    {caseImportRows&&<CaseImportDialog project={project} rows={caseImportRows} onClose={()=>setCaseImportRows(null)} onApply={cases=>{onChange({...project,cases});setCaseImportRows(null);setMessage('Case import applied.');}}/>}</section>
  </div>;
}
