import { Project, CodedSegment } from '../domain';
export function excerptResearch(project:Project,id:string,docId:string,segment?:CodedSegment) {
  const source=project.images?.find(i=>i.id===docId);
  const cases=(project.cases||[]).filter(c=>c.links.some(l=>l.docId===docId||(l.docId===source?.pdfPage?.docId&&l.start===undefined))).filter(c=>!segment||c.links.some(l=>l.docId===docId&&(l.start===undefined||segment.start<l.end!&&segment.end>l.start)));
  const annotations=segment?(project.annotations||[]).filter(a=>a.docId===docId&&a.start<segment.end&&a.end>segment.start):[];
  const memos=(project.memos||[]).filter(m=>m.segmentIds.includes(id));
  return {
    cases:cases.map(c=>c.name).join('; '),attributes:cases.map(c=>c.name+': '+Object.entries(c.attributes).map(([k,v])=>k+'='+v).join(', ')).join('; '),
    sourceGroups:(project.groups||[]).filter(g=>g.kind==='documents'&&(g.memberIds.includes(docId)||g.memberIds.includes(source?.pdfPage?.docId||''))).map(g=>g.name).join('; '),
    notes:[...annotations.map(a=>'Annotation: '+a.note),...memos.map(m=>m.title+': '+m.text),...cases.filter(c=>c.notes).map(c=>'Case memo — '+c.name+': '+c.notes)].join('\n\n')
  };
}
export function linkedMemos(project:Project,kind:'codeIds'|'docIds',id:string){return (project.memos||[]).filter(m=>m[kind].includes(id)).map(m=>m.title+': '+m.text).join('\n\n');}
