import { Project, ResearchMemo, uid } from '../domain';

export interface MemoRecord extends ResearchMemo { origin: { kind: string; id: string }; }
export const memoCategories: Record<string, string> = {standalone:'Project memos', document:'Document memos', image:'Document memos', code:'Code memos', framework:'Framework matrix memos', relationship:'Code co-occurrence memos', excerpt:'Quote notes', region:'Quote notes', annotation:'Annotations', case:'Case memos', map:'Visualization labels', edge:'Visualization labels', visualization:'Visualization notes','visualization-draft':'Visualization notes'};
export function memoCategory(memo: MemoRecord) { return memoCategories[memo.origin.kind] || 'Other notes'; }
export function listMemoRecords(project: Project): MemoRecord[] {
  const records: MemoRecord[] = (project.memos || []).map(m => ({ ...m, origin:{kind:'standalone',id:m.id} }));
  const sources = new Map([...project.docs,...(project.images || [])].map(s => [s.id,s.name]));
  const codes = new Map(project.codes.map(c => [c.id,c.name]));
  const source = (id: string) => sources.get(id) || 'Unavailable source';
  const code = (id: string) => codes.get(id) || 'Unavailable code';
  function add(kind: string, id: string, title: string, text: string | undefined, docIds: string[] = [], codeIds: string[] = [], caseIds: string[] = [], segmentIds: string[] = [], createdAt = 0, updatedAt = 0) {
    if (!text?.trim() && kind !== 'annotation') return;
    records.push({ id:`note:${kind}:${id}`, title, text: text || '', kind:'analytic', docIds, codeIds, caseIds, segmentIds, createdAt, updatedAt, origin:{kind,id} });
  }
  project.docs.forEach(d => add('document',d.id,'Source memo — '+d.name,d.notes,[d.id]));
  project.codes.forEach(c => add('code',c.id,'Code memo — '+c.name,c.summary,[],[c.id]));
  project.codedSegments.forEach(s => add('excerpt',s.id,'Excerpt memo — '+source(s.docId)+' / '+code(s.codeId),s.note,[s.docId],[s.codeId],[],[s.id],s.createdAt));
  project.images?.forEach(i => add('image',i.id,'Image memo — '+i.name,i.notes,[i.id]));
  project.codedRegions?.forEach(r => add('region',r.id,'Region memo — '+source(r.imageId)+' / '+code(r.codeId),r.note,[r.imageId],[r.codeId],[],[r.id],r.createdAt));
  project.frameworkCells?.forEach(f => add('framework',f.id,'Framework memo — '+source(f.docId)+' / '+code(f.codeId),f.text,[f.docId],[f.codeId],[],[],0,f.updatedAt));
  project.relationNotes?.forEach(r => add('relationship',r.id,'Relationship memo — '+code(r.codeAId)+' / '+code(r.codeBId),r.note,[],[r.codeAId,r.codeBId],[],[],0,r.updatedAt));
  project.cases?.forEach(c => add('case',c.id,'Case memo — '+c.name,c.notes,c.links.map(l => l.docId),[],[c.id]));
  project.annotations?.forEach(a => add('annotation',a.id,'Passage annotation — '+source(a.docId),a.note,[a.docId],[],[],[],a.createdAt));
  project.mapAnnotations?.forEach(a => add('map',a.id,'Code map note',a.text));
  project.mapEdgeStyles?.forEach(e => add('edge',e.id,'Code map link — '+code(e.fromCodeId)+' / '+code(e.toCodeId),e.label,[],[e.fromCodeId,e.toCodeId]));
  project.visualizationNotes?.forEach(note=>add('visualization',note.id,'Working visualization — '+note.title,note.text,[],[],[],[],0,note.updatedAt));
  project.mapDrafts?.forEach(draft=>draft.notes?.forEach(note=>add('visualization-draft',draft.id+'::'+note.id,draft.name+' — '+note.title,note.text,[],[],[],[],0,note.updatedAt)));
  return records;
}

/** Update only a memo field; never change its source text, code or coding location. */
export function updateMemoText(project: Project, record: MemoRecord, text: string): Project {
  const {kind,id} = record.origin, now = Date.now();
  if(kind==='visualization')return {...project,visualizationNotes:project.visualizationNotes?.map(note=>note.id===id?{...note,text,updatedAt:now}:note)};
  if(kind==='visualization-draft'){const [draftId,noteId]=id.split('::');return {...project,mapDrafts:project.mapDrafts?.map(draft=>draft.id===draftId?{...draft,updatedAt:now,notes:draft.notes?.map(note=>note.id===noteId?{...note,text,updatedAt:now}:note)}:draft)};}
  if (kind === 'standalone') return {...project,memos:project.memos?.map(m => m.id === id ? {...m,text,updatedAt:now} : m)};
  if (kind === 'document') return {...project,docs:project.docs.map(d => d.id === id ? {...d,notes:text} : d)};
  if (kind === 'code') return {...project,codes:project.codes.map(c => c.id === id ? {...c,summary:text} : c)};
  if (kind === 'excerpt') return {...project,codedSegments:project.codedSegments.map(s => s.id === id ? {...s,note:text} : s)};
  if (kind === 'image') return {...project,images:project.images?.map(i => i.id === id ? {...i,notes:text} : i)};
  if (kind === 'region') return {...project,codedRegions:project.codedRegions?.map(r => r.id === id ? {...r,note:text} : r)};
  if (kind === 'framework') return {...project,frameworkCells:project.frameworkCells?.map(f => f.id === id ? {...f,text,updatedAt:now} : f)};
  if (kind === 'relationship') return {...project,relationNotes:project.relationNotes?.map(r => r.id === id ? {...r,note:text,updatedAt:now} : r)};
  if (kind === 'case') return {...project,cases:project.cases?.map(c => c.id === id ? {...c,notes:text} : c)};
  if (kind === 'annotation') return {...project,annotations:text.trim() ? project.annotations?.map(a => a.id === id ? {...a,note:text} : a) : project.annotations?.filter(a => a.id !== id)};
  if (kind === 'map') return {...project,mapAnnotations:project.mapAnnotations?.map(a => a.id === id ? {...a,text} : a)};
  if (kind === 'edge') return {...project,mapEdgeStyles:project.mapEdgeStyles?.map(e => e.id === id ? {...e,label:text} : e)};
  throw new Error('This memo is no longer available.');
}

export function mergeMemos(project: Project, ids: string[], targetId: string, title = 'Merged memo'): Project {
  const selected = listMemoRecords(project).filter(memo => ids.includes(memo.id));
  const target = targetId === 'new' && selected.length >= 2 ? {id:uid('memo'),title:title.trim() || 'Merged memo',text:'',kind:'analytic' as const,createdAt:Date.now()} : selected.find(memo => memo.id === targetId && memo.origin.kind === 'standalone');
  if (!target || selected.length < 2) throw new Error('Select at least two memos and a destination memo.');
  const others = selected.filter(memo => memo.id !== targetId);
  const links = (key: 'docIds' | 'codeIds' | 'caseIds' | 'segmentIds') => Array.from(new Set(selected.flatMap(memo => memo[key])));
  const merged: ResearchMemo = { id:target.id, title:target.title, kind:target.kind, createdAt:target.createdAt, text: [target.text, ...others.map(memo => `${memo.title}\n${memo.text}`)].filter(Boolean).join('\n\n'), docIds: links('docIds'), codeIds: links('codeIds'), caseIds: links('caseIds'), segmentIds: links('segmentIds'), updatedAt: Date.now() };
  let next = project;
  for (const record of selected.filter(m => m.origin.kind !== 'standalone')) next = updateMemoText(next,record,'');
  return { ...next, memos:[...(next.memos || []).filter(memo => !ids.includes(memo.id)),merged] };
}

export function memoExportRows(project: Project, ids: string[]) {
  const selected = new Set(ids);
  const sources = new Map([...project.docs,...(project.images || [])].map(s => [s.id,s.name]));
  const codes = new Map(project.codes.map(c => [c.id,c.name]));
  const cases = new Map((project.cases || []).map(c => [c.id,c.name]));
  const segments = new Map(project.codedSegments.map(s => [s.id,s]));
  const regions = new Map((project.codedRegions || []).map(r => [r.id,r]));
  const annotations = new Map((project.annotations || []).map(a => [a.id,a]));
  const caseRecords = new Map((project.cases || []).map(c => [c.id,c]));
  const codeSources = new Map<string,Set<string>>();
  for(const item of [...project.codedSegments,...(project.codedRegions || [])]) {
    const sourceId='docId' in item ? item.docId : item.imageId;
    const linked=codeSources.get(item.codeId) || new Set<string>();linked.add(sourceId);codeSources.set(item.codeId,linked);
  }
  const names = (list: string[], items: Map<string,string>) => list.map(id => items.get(id) || 'Unavailable link').join('; ');
  const sourceName = (id:string) => sources.get(id) || `Unavailable source (${id})`;
  return listMemoRecords(project).filter(memo => selected.has(memo.id)).map(memo => {
    const annotation=memo.origin.kind==='annotation'?annotations.get(memo.origin.id):undefined;
    const linkedSegments=memo.segmentIds.flatMap(id=>segments.get(id)?[segments.get(id)!]:[]);
    const linkedRegions=memo.segmentIds.flatMap(id=>regions.get(id)?[regions.get(id)!]:[]);
    const directSources=Array.from(new Set([...memo.docIds,...linkedSegments.map(s=>s.docId),...linkedRegions.map(r=>r.imageId),...memo.caseIds.flatMap(id=>caseRecords.get(id)?.links.map(l=>l.docId)||[])]));
    const relatedSources=Array.from(new Set(memo.codeIds.flatMap(id=>Array.from(codeSources.get(id)||[])))).filter(id=>!directSources.includes(id));
    const kind=memo.origin.kind;
    const sourceLabel=kind==='standalone'?`Project memo — ${project.name}`:kind==='framework'?`Framework matrix — ${directSources.map(sourceName).join('; ')} × ${names(memo.codeIds,codes)}`:kind==='relationship'?`Code co-occurrence matrix — ${names(memo.codeIds,codes)}`:kind==='code'?`Codebook — ${names(memo.codeIds,codes)}`:kind==='case'?`Case — ${names(memo.caseIds,cases)}`:kind==='map'||kind==='edge'?`Code Map${memo.codeIds.length?' — '+names(memo.codeIds,codes):''}`:`${memoCategory(memo)} — ${directSources.map(sourceName).join('; ')}`;
    const location=(sourceId:string,start:number,end:number)=>`${sourceName(sourceId)}: characters ${start}–${end} (zero-based, end exclusive)`;
    return {
    Title: memo.title, Category: memoCategory(memo), Purpose: memo.kind, Memo: memo.text, 'Memo ID': memo.id, 'Source type': memo.origin.kind, 'Source ID': memo.origin.id,
    Source:sourceLabel, Documents: directSources.map(sourceName).join('; '), 'Related documents':relatedSources.map(sourceName).join('; '), Codes: names(memo.codeIds, codes), Cases: names(memo.caseIds, cases),
    Excerpts: [annotation?`${sourceName(annotation.docId)}: ${annotation.text || ''}`:'',...memo.segmentIds.map(id => { const segment = segments.get(id); if (segment) return `${sourceName(segment.docId)}: ${segment.text}`; const region = regions.get(id); return region ? `${sourceName(region.imageId)}: image region` : `Unavailable excerpt (${id})`; })].filter(Boolean).join('; '),
    Location:[...linkedSegments.filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)).map(s=>location(s.docId,s.start,s.end)),...linkedRegions.map(r=>`${sourceName(r.imageId)}: region x=${r.x}, y=${r.y}, width=${r.width}, height=${r.height}`),...(annotation&&Number.isFinite(annotation.start)?[location(annotation.docId,annotation.start,annotation.end)]:[])].join('; '),
    Coder:Array.from(new Set([...linkedSegments.map(s=>s.coder),...linkedRegions.map(r=>r.coder),annotation?.author].filter(Boolean))).join('; '),
    Created: memo.createdAt ? new Date(memo.createdAt).toISOString() : '', Updated: memo.updatedAt ? new Date(memo.updatedAt).toISOString() : ''
  };});
}
