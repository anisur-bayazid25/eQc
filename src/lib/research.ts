import { Project, ResearchCase, ResearchQuery, CodedSegment, CodedRegion, ID, uid, descendantCodeIds, colorForNewCode, normalizeCoderName } from '../domain';
import { relocateSegmentsAfterEdit } from './relocateSegments';

/** Relocate analytic references with coding text. Unmatched notes remain in the memo library. */
export function relocateResearchAfterEdit(project: Project, docId: string, content: string): Project {
  const doc = project.docs.find(d=>d.id===docId); if(!doc)return project;
  const move = (id:string,start:number,end:number) => relocateSegmentsAfterEdit(doc.content,content,[{id,docId,codeId:'',start,end,text:doc.content.slice(start,end),createdAt:0,source:'manual'}]).segments[0];
  const memos = [...(project.memos||[])];
  const annotations = project.annotations?.flatMap(a=>{
    if(a.docId!==docId)return [a];const s=move(a.id,a.start,a.end);
    if(s)return [{...a,start:s.start,end:s.end,text:s.text}];
    memos.push({id:uid('memo'),title:`Unlinked annotation — ${doc.name}`,text:`${a.text}\n\n${a.note}`,kind:'analytic',docIds:[docId],codeIds:[],caseIds:[],segmentIds:[],createdAt:a.createdAt,updatedAt:Date.now()});return [];
  });
  const cases = project.cases?.map(c=>({...c,links:c.links.flatMap((l,index)=>{
    if(l.docId!==docId||l.start===undefined)return [l];const s=move(`${c.id}-${index}`,l.start,l.end!);
    if(s)return [{...l,start:s.start,end:s.end}];
    memos.push({id:uid('memo'),title:`Unlinked case passage — ${c.name}`,text:doc.content.slice(l.start,l.end),kind:'analytic',docIds:[docId],codeIds:[],caseIds:[c.id],segmentIds:[],createdAt:Date.now(),updatedAt:Date.now()});return [];
  })}));
  return {...project,annotations,cases,...(memos.length?{memos}:{})};
}

export function emptyQuery(): ResearchQuery {
  return { id: uid('query'), name: '', operator: 'any', codeIds: [], excludeCodeIds: [], codeGroupIds: [], descendants: false, docIds: [], documentGroupIds: [], caseIds: [], coder: '', text: '', distance: 100, starredOnly: false };
}
export interface RetrievedExcerpt { id: ID; type: 'text' | 'image'; sourceId: ID; sourceName: string; codeId: ID; coder: string; text: string; segment?: CodedSegment; region?: CodedRegion; caseIds: ID[] }
// Cases can contain thousands of speaker turns. Index once per immutable cases
// collection, rather than scanning every participant's links for every quote.
const caseSourceIndexes = new WeakMap<ResearchCase[], Map<string, Array<{value:ResearchCase;links:ResearchCase['links']}>>>();
export function casesForSegment(project: Project, segment: CodedSegment): ResearchCase[] {
  if (!project.cases) return [];
  let index = caseSourceIndexes.get(project.cases);
  if (!index) {
    index = new Map();
    for (const value of project.cases) {
      const bySource = new Map<string,ResearchCase['links']>();
      for (const link of value.links) { const links=bySource.get(link.docId)||[];links.push(link);bySource.set(link.docId,links); }
      for (const [docId,links] of bySource) { const entries=index.get(docId)||[];entries.push({value,links});index.set(docId,entries); }
    }
    caseSourceIndexes.set(project.cases,index);
  }
  return (index.get(segment.docId)||[]).filter(c=>c.links.some(l=>l.start===undefined || segment.start<l.end! && segment.end>l.start)).map(c=>c.value);
}
function attributeMatches(c: ResearchCase, query: ResearchQuery): boolean {
  const rule = query.attribute; if (!rule || !rule.name) return true;
  const value = c.attributes[rule.name]; if (value === undefined) return false;
  if (rule.operator === 'equals') return value.toLocaleLowerCase() === rule.value.toLocaleLowerCase();
  if (rule.operator === 'contains') return value.toLocaleLowerCase().includes(rule.value.toLocaleLowerCase());
  if (!value.trim() || !rule.value.trim() || !Number.isFinite(Number(value)) || !Number.isFinite(Number(rule.value))) return false;
  return rule.operator === 'gt' ? Number(value) > Number(rule.value) : Number(value) < Number(rule.value);
}
export function retrieveExcerpts(project: Project, query: ResearchQuery): RetrievedExcerpt[] {
  if (query.needsScopeReview) return [];
  const codes = new Set(query.codeIds);
  const excluded = new Set(query.excludeCodeIds);
  const restrictCodes = query.codeIds.length > 0 || query.codeGroupIds.length > 0;
  for (const g of project.groups || []) if (g.kind === 'codes' && query.codeGroupIds.includes(g.id)) for (const id of g.memberIds) codes.add(id);
  const required=Array.from(codes,id=>query.descendants?descendantCodeIds(project.codes,id):new Set([id]));
  if (query.descendants) for (const id of Array.from(codes)) for (const child of descendantCodeIds(project.codes, id)) codes.add(child);
  if (query.descendants) for (const id of Array.from(excluded)) for (const child of descendantCodeIds(project.codes, id)) excluded.add(child);
  const sourceIds = new Set(query.docIds);
  for (const g of project.groups || []) if (g.kind === 'documents' && query.documentGroupIds.includes(g.id)) for (const id of g.memberIds) sourceIds.add(id);
  const restrictSources = query.docIds.length > 0 || query.documentGroupIds.length > 0;
  const restrictCases = query.caseIds.length > 0 || !!query.attribute?.name;
  const eligibleCases = new Set((project.cases || []).filter(c => (!query.caseIds.length || query.caseIds.includes(c.id)) && attributeMatches(c, query)).map(c => c.id));
  const docById = new Map(project.docs.map(d => [d.id, d]));
  const images = new Map((project.images || []).map(i => [i.id, i]));
  const validCodes = new Set(project.codes.map(c=>c.id));
  const common = (codeId: ID, coder: string | undefined, starred?: boolean) => validCodes.has(codeId) && (!query.coder || normalizeCoderName(coder) === normalizeCoderName(query.coder)) && (!query.starredOnly || starred);
  // Apply source/case/coder scopes BEFORE boolean conditions. A participant's
  // coding must not acquire another FGD speaker's code through source-level AND.
  const textRows: RetrievedExcerpt[] = project.codedSegments.flatMap(segment => {
    if (query.operator === 'any' && restrictCodes && !codes.has(segment.codeId)) return [];
    const doc = docById.get(segment.docId); if (!doc || !common(segment.codeId, segment.coder, segment.starred) || (restrictSources && !sourceIds.has(doc.id))) return [];
    const memberships = casesForSegment(project, segment).map(c => c.id);
    if (restrictCases && !memberships.some(id => eligibleCases.has(id))) return [];
    return [{ id: segment.id, type: 'text' as const, sourceId: doc.id, sourceName: doc.name, codeId: segment.codeId, coder: normalizeCoderName(segment.coder), text: doc.content.slice(segment.start, segment.end), segment, caseIds: memberships }];
  });
  const imageRows: RetrievedExcerpt[] = (project.codedRegions || []).flatMap(region => {
    if (query.operator === 'any' && restrictCodes && !codes.has(region.codeId)) return [];
    const image = images.get(region.imageId); if (!image || !common(region.codeId, region.coder, region.starred)) return [];
    if (restrictSources && !sourceIds.has(image.id) && !sourceIds.has(image.pdfPage?.docId || '')) return [];
    const memberships = (project.cases || []).filter(c => c.links.some(l => (l.docId === image.id || l.docId === image.pdfPage?.docId) && l.start === undefined)).map(c => c.id);
    if (restrictCases && !memberships.some(id => eligibleCases.has(id))) return [];
    return [{ id: region.id, type: 'image' as const, sourceId: image.id, sourceName: image.name, codeId: region.codeId, coder: normalizeCoderName(region.coder), text: image.notes || '', region, caseIds: memberships }];
  });
  const rows = [...textRows, ...imageRows];
  const bySource = new Map<string, RetrievedExcerpt[]>();
  for (const row of rows) { const list = bySource.get(row.sourceId) || []; list.push(row); bySource.set(row.sourceId, list); }
  const close = (a: RetrievedExcerpt, b: RetrievedExcerpt, near: boolean) => {
    if (a.segment && b.segment) return near
      ? Math.max(0, a.segment.start - b.segment.end, b.segment.start - a.segment.end) <= Math.max(0, query.distance)
      : a.segment.start < b.segment.end && b.segment.start < a.segment.end;
    if (a.region && b.region && !near) return a.region.x < b.region.x + b.region.width && b.region.x < a.region.x + a.region.width && a.region.y < b.region.y + b.region.height && b.region.y < a.region.y + a.region.height;
    return false;
  };
  return rows.filter(row => {
    if (restrictCodes && !codes.has(row.codeId)) return false;
    const peers = bySource.get(row.sourceId)!;
    if (query.operator === 'without' && peers.some(p => excluded.has(p.codeId))) return false;
    if (query.operator === 'all' && !required.every(branch => peers.some(p => branch.has(p.codeId)))) return false;
    if (query.operator === 'overlap' || query.operator === 'near') {
      if (required.length < 2 || !required.filter(branch => !branch.has(row.codeId)).every(branch => peers.some(p => branch.has(p.codeId) && close(row, p, query.operator === 'near')))) return false;
    }
    return !query.text || [row.text, row.segment?.note || row.region?.note || ''].join('\n').toLocaleLowerCase().includes(query.text.toLocaleLowerCase());
  }).sort((a, b) => a.sourceName.localeCompare(b.sourceName) || (a.segment?.start || 0) - (b.segment?.start || 0) || a.id.localeCompare(b.id));
}

export function excerptContext(project: Project, row: RetrievedExcerpt, radius = 180): { before: string; text: string; after: string } {
  if (!row.segment) return { before: '', text: row.text, after: '' };
  const text = project.docs.find(d => d.id === row.sourceId)?.content || '';
  return { before: text.slice(Math.max(0, row.segment.start - radius), row.segment.start), text: text.slice(row.segment.start, row.segment.end), after: text.slice(row.segment.end, row.segment.end + radius) };
}
export function reassignExcerpts(project: Project, ids: ID[], codeId: ID): Project {
  if (!project.codes.some(c => c.id === codeId)) throw new Error('Choose an existing code.');
  const selected = new Set(ids);
  return { ...project, codedSegments: project.codedSegments.map(s => selected.has(s.id) ? { ...s, codeId } : s), codedRegions: project.codedRegions?.map(r => selected.has(r.id) ? { ...r, codeId } : r) };
}
export function splitCode(project: Project, fromId: ID, excerptIds: ID[], name: string): Project {
  const parent = project.codes.find(c => c.id === fromId);
  if (!parent || !name.trim() || !excerptIds.length) throw new Error('Choose a code, select excerpts and enter a new code name.');
  const validIds = new Set([...project.codedSegments, ...(project.codedRegions || [])].filter(s => s.codeId === fromId).map(s => s.id));
  if (excerptIds.some(id => !validIds.has(id))) throw new Error('Selected excerpts must all belong to the code being split.');
  const code = { id: uid('code'), name: name.trim(), parentId: parent.parentId, color: colorForNewCode(project.codes, parent.parentId, project.codes.length), summary: '', definition: '', createdAt: Date.now() };
  return reassignExcerpts({ ...project, codes: [...project.codes, code] }, excerptIds, code.id);
}
export function resizeExcerpt(project: Project, id: ID, start: number, end: number): Project {
  const segment = project.codedSegments.find(s => s.id === id), doc = project.docs.find(d => d.id === segment?.docId);
  if (!segment || !doc || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > doc.content.length || !doc.content.slice(start, end).trim()) throw new Error('Choose a nonempty range inside the source document.');
  return { ...project, codedSegments: project.codedSegments.map(s => s.id === id ? { ...s, start, end, text: doc.content.slice(start, end) } : s) };
}
export function cleanResearchLinks(project: Project): Project {
  const retain = <T,>(items: T[], predicate: (item:T)=>boolean): T[] => { const next=items.filter(predicate);return next.length===items.length?items:next; };
  const mapRetain = <T,>(items: T[], map: (item:T)=>T): T[] => { const next=items.map(map);return next.every((item,i)=>item===items[i])?items:next; };
  const docs = new Set(project.docs.map(d => d.id)), codes = new Set(project.codes.map(c => c.id)), images = new Set(project.images?.map(i => i.id)), segments = new Set([...project.codedSegments,...(project.codedRegions||[])].map(s => s.id)), cases = new Set(project.cases?.map(c => c.id));
  return { ...project,
    caseFrameworkCells:project.caseFrameworkCells&&retain(project.caseFrameworkCells,c=>cases.has(c.caseId)&&codes.has(c.codeId)),
    reviewedSources:project.reviewedSources&&retain(project.reviewedSources,r=>docs.has(r.sourceId)||images.has(r.sourceId)),
    frameworkCells: project.frameworkCells&&retain(project.frameworkCells,cell => docs.has(cell.docId) && codes.has(cell.codeId)),
    cases: project.cases&&mapRetain(project.cases,c=>{const links=retain(c.links,l=>docs.has(l.docId)||images.has(l.docId));return links===c.links?c:{...c,links};}),
    groups: project.groups&&mapRetain(project.groups,g=>{const memberIds=retain(g.memberIds,id=>g.kind==='codes'?codes.has(id):docs.has(id)||images.has(id));return memberIds===g.memberIds?g:{...g,memberIds};}),
    annotations: project.annotations&&retain(project.annotations,a => docs.has(a.docId)),
    memos: project.memos&&mapRetain(project.memos,m=>{
      const docIds=retain(m.docIds,id=>docs.has(id)||images.has(id)),codeIds=retain(m.codeIds,id=>codes.has(id)),caseIds=retain(m.caseIds,id=>cases.has(id)),segmentIds=retain(m.segmentIds,id=>segments.has(id));
      return docIds===m.docIds&&codeIds===m.codeIds&&caseIds===m.caseIds&&segmentIds===m.segmentIds?m:{...m,docIds,codeIds,caseIds,segmentIds};
    }),
    // Saved query references deliberately remain: deleting their final scoped
    // item must produce no results rather than silently broaden to all items.
    queries: project.queries
  };
}
