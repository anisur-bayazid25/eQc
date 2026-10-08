import Papa from 'papaparse';
import { Project } from '../domain';
import { buildCodeReport } from './codeReport';
import { RetrievedExcerpt } from './research';
import { sourceLineRange } from './sourceLines';

export function researchRows(project: Project): string[][] {
  const rows: string[][] = [['Item type', 'Name', 'Document', 'Code', 'Case', 'Location', 'Text / value', 'Created', 'Updated']];
  const names = (ids: string[], list: Array<{ id: string; name: string }>) => list.filter(x => ids.includes(x.id)).map(x => x.name).join('; ');
  for (const c of project.cases || []) {
    rows.push(['Case', c.name, names(c.links.map(l => l.docId), [...project.docs,...(project.images||[])]), '', c.name, '', c.notes || '', '', '']);
    for (const [key, value] of Object.entries(c.attributes)) rows.push(['Attribute', key, '', '', c.name, '', value, '', '']);
    for (const link of c.links) {
      const doc = project.docs.find(d => d.id === link.docId);
      const image = project.images?.find(i=>i.id===link.docId);
      if(image)rows.push(['Case link',c.name,image.name,'',c.name,'Whole image','','','']);
      if (doc) rows.push(['Case link', c.name, doc.name, '', c.name, link.start === undefined ? 'Whole source' : sourceLineRange(doc.content, link.start, link.end!), link.start === undefined ? '' : doc.content.slice(link.start, link.end), '', '']);
    }
  }
  for (const g of project.groups || []) rows.push(['Group', g.name, g.kind === 'documents' ? names(g.memberIds, [...project.docs, ...(project.images || [])]) : '', g.kind === 'codes' ? names(g.memberIds, project.codes) : '', '', '', g.kind, '', '']);
  for (const a of project.annotations || []) {
    const doc = project.docs.find(d => d.id === a.docId);
    rows.push(['Annotation', a.author || 'Unspecified', doc?.name || 'Missing source', '', '', doc ? sourceLineRange(doc.content, a.start, a.end) : '', `${a.text}\n${a.note}`, new Date(a.createdAt).toISOString(), '']);
  }
  for (const m of project.memos || []) rows.push([`Memo: ${m.kind}`, m.title, names(m.docIds, [...project.docs,...(project.images||[])]), names(m.codeIds, project.codes), names(m.caseIds, project.cases || []), m.segmentIds.map(id => {
    const s = project.codedSegments.find(s => s.id === id), d = project.docs.find(d => d.id === s?.docId);
    const r=project.codedRegions?.find(r=>r.id===id),image=project.images?.find(i=>i.id===r?.imageId);
    return d && s ? `${d.name}: ${sourceLineRange(d.content, s.start, s.end)}` : r&&image?image.name+': coded image region':'';
  }).filter(Boolean).join('; '), m.text, new Date(m.createdAt).toISOString(), new Date(m.updatedAt).toISOString()]);
  for (const d of project.docs.filter(d => d.notes?.trim())) rows.push(['Source memo', d.name, d.name, '', '', '', d.notes!, '', '']);
  for (const c of project.codes.filter(c => c.summary?.trim())) rows.push(['Code memo', c.name, '', c.name, '', '', c.summary, '', '']);
  for (const s of project.codedSegments.filter(s => s.note?.trim())) {
    const doc = project.docs.find(d => d.id === s.docId);
    rows.push(['Excerpt memo', s.id, doc?.name || 'Missing source', names([s.codeId], project.codes), '', doc ? sourceLineRange(doc.content, s.start, s.end) : '', s.note!, '', '']);
  }
  for (const i of (project.images || []).filter(i => i.notes?.trim())) rows.push(['Image memo', i.name, i.name, '', '', '', i.notes!, '', '']);
  for (const r of (project.codedRegions || []).filter(r => r.note?.trim())) rows.push(['Region memo', r.id, names([r.imageId], project.images || []), names([r.codeId], project.codes), '', '', r.note!, '', '']);
  for (const f of project.frameworkCells || []) if (f.text.trim()) rows.push(['Framework memo', f.id, names([f.docId], project.docs), names([f.codeId], project.codes), '', '', f.text, '', '']);
  for (const r of project.relationNotes || []) if (r.note.trim()) rows.push(['Relationship memo', r.id, '', names([r.codeAId, r.codeBId], project.codes), '', '', r.note, '', '']);
  for (const q of project.queries || []) rows.push(['Saved query', q.name, names(q.docIds, [...project.docs,...(project.images||[])]), names(q.codeIds, project.codes), names(q.caseIds, project.cases || []), '', [
    'Combination: '+({any:'Any selected code (OR)',all:'All selected codes in source (AND)',without:'Selected codes without B in source',overlap:'Intersecting coding',near:'Nearby text coding'}[q.operator]),
    'Codes: '+(names(q.codeIds,project.codes)||(!q.codeIds.length&&!q.codeGroupIds.length?'All codes':'Missing or group-selected codes')),
    q.excludeCodeIds.length?'Excluded codes B: '+names(q.excludeCodeIds,project.codes):'',
    q.codeGroupIds.length?'Code groups: '+names(q.codeGroupIds,project.groups||[]):'',q.documentGroupIds.length?'Source groups: '+names(q.documentGroupIds,project.groups||[]):'',
    'Coder: '+(q.coder||'All coders'),q.descendants?'Include child codes':'',q.starredOnly?'Key excerpts only':'',q.text?'Excerpt/note search: '+q.text:'',
    q.attribute?.name?'Case attribute: '+q.attribute.name+' '+q.attribute.operator+' '+q.attribute.value:'',q.operator==='near'?'Maximum gap: '+q.distance+' coding-text characters':''
  ].filter(Boolean).join('\n'), '', '']);
  return rows;
}
export function researchCsv(project: Project): string { return Papa.unparse(researchRows(project)); }
export function researchHtml(project: Project): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const rows = researchRows(project);
  return `<section><h2>Research records</h2><p>Cases, attributes, groups, annotations, memos and saved query definitions.</p><table><thead><tr>${rows[0].map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(row => `<tr>${row.map(x => `<td style="white-space:pre-wrap">${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}
export function retrievedReport(project: Project, rows: RetrievedExcerpt[], title: string) {
  const textIds = new Set(rows.filter(r => r.type === 'text').map(r => r.id)), imageIds = new Set(rows.filter(r => r.type === 'image').map(r => r.id));
  const selected = { ...project, codedSegments: project.codedSegments.filter(s => textIds.has(s.id)), codedRegions: project.codedRegions?.filter(r => imageIds.has(r.id)) };
  const report = buildCodeReport(selected, 'codesExcerptsSummaries', new Set(rows.map(r => r.codeId)));
  report.title = title || 'Retrieved excerpts';
  report.filenameBase = `${project.name}_${title || 'Retrieved excerpts'}`;
  report.description = `${rows.length} coding entries retrieved. Code combinations are evaluated within the selected source, case and coder scope. Text remains grouped by document and code.`;
  return report;
}
