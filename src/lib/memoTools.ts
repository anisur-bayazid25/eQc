import { Project, ResearchMemo, uid } from '../domain';

export interface MemoRecord extends ResearchMemo { origin: { kind: string; id: string }; }
export function listMemoRecords(project: Project): MemoRecord[] {
  const records: MemoRecord[] = (project.memos || []).map(m => ({ ...m, origin:{kind:'standalone',id:m.id} }));
  const source = (id: string) => [...project.docs,...(project.images || [])].find(s => s.id === id)?.name || 'Unavailable source';
  const code = (id: string) => project.codes.find(c => c.id === id)?.name || 'Unavailable code';
  function add(kind: string, id: string, title: string, text: string | undefined, docIds: string[] = [], codeIds: string[] = [], caseIds: string[] = [], segmentIds: string[] = [], createdAt = 0, updatedAt = 0) {
    if (!text?.trim()) return;
    records.push({ id:`note:${kind}:${id}`, title, text, kind:'analytic', docIds, codeIds, caseIds, segmentIds, createdAt, updatedAt, origin:{kind,id} });
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
  return records;
}

/** Update only a memo field; never change its source text, code or coding location. */
export function updateMemoText(project: Project, record: MemoRecord, text: string): Project {
  const {kind,id} = record.origin, now = Date.now();
  if (kind === 'standalone') return {...project,memos:project.memos?.map(m => m.id === id ? {...m,text,updatedAt:now} : m)};
  if (kind === 'document') return {...project,docs:project.docs.map(d => d.id === id ? {...d,notes:text} : d)};
  if (kind === 'code') return {...project,codes:project.codes.map(c => c.id === id ? {...c,summary:text} : c)};
  if (kind === 'excerpt') return {...project,codedSegments:project.codedSegments.map(s => s.id === id ? {...s,note:text} : s)};
  if (kind === 'image') return {...project,images:project.images?.map(i => i.id === id ? {...i,notes:text} : i)};
  if (kind === 'region') return {...project,codedRegions:project.codedRegions?.map(r => r.id === id ? {...r,note:text} : r)};
  if (kind === 'framework') return {...project,frameworkCells:project.frameworkCells?.map(f => f.id === id ? {...f,text,updatedAt:now} : f)};
  if (kind === 'relationship') return {...project,relationNotes:project.relationNotes?.map(r => r.id === id ? {...r,note:text,updatedAt:now} : r)};
  if (kind === 'case') return {...project,cases:project.cases?.map(c => c.id === id ? {...c,notes:text} : c)};
  if (kind === 'annotation') return {...project,annotations:project.annotations?.map(a => a.id === id ? {...a,note:text} : a)};
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
  const names = (list: string[], items: Array<{ id: string; name: string }>) => list.map(id => items.find(item => item.id === id)?.name || 'Unavailable link').join('; ');
  return listMemoRecords(project).filter(memo => ids.includes(memo.id)).map(memo => ({
    Title: memo.title, Purpose: memo.kind, Memo: memo.text,
    Documents: names(memo.docIds, [...project.docs, ...(project.images || [])]), Codes: names(memo.codeIds, project.codes), Cases: names(memo.caseIds, project.cases || []),
    Excerpts: memo.segmentIds.map(id => { const segment = project.codedSegments.find(s => s.id === id); if (segment) return `${project.docs.find(d => d.id === segment.docId)?.name}: ${segment.text}`; const region = project.codedRegions?.find(r => r.id === id); return region ? `${project.images?.find(i => i.id === region.imageId)?.name}: image region` : 'Unavailable excerpt'; }).join('; '),
    Created: memo.createdAt ? new Date(memo.createdAt).toISOString() : '', Updated: memo.updatedAt ? new Date(memo.updatedAt).toISOString() : ''
  }));
}
