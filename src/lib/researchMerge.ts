import { Project, uid } from '../domain';

/** Import independent research records, remapping every reference and deduplicating repeat merges. */
export function mergeResearch(target: Project, source: Project, docs: Map<string,string>, codes: Map<string,string>, images: Map<string,string>, excerpts:Map<string,string>=new Map()) {
  const mapped = (ids:string[],map:Map<string,string>) => Array.from(new Set(ids.flatMap(id=>map.has(id)?[map.get(id)!]:[])));
  const sourceMap = new Map([...docs,...images]);
  const caseMap = new Map<string,string>(), groupMap = new Map<string,string>(), excerptMap = new Map(excerpts);
  for(const s of source.codedSegments) {
    const existing=target.codedSegments.find(t=>t.docId===docs.get(s.docId)&&t.codeId===codes.get(s.codeId)&&t.start===s.start&&t.end===s.end&&t.coder===(s.coder||source.coderName));
    if(existing)excerptMap.set(s.id,existing.id);
  }
  for(const r of source.codedRegions||[]) {
    const existing=target.codedRegions?.find(t=>t.imageId===images.get(r.imageId)&&t.codeId===codes.get(r.codeId)&&t.x===r.x&&t.y===r.y&&t.width===r.width&&t.height===r.height&&t.coder===(r.coder||source.coderName));
    if(existing)excerptMap.set(r.id,existing.id);
  }
  const unique = <T,>(values:T[]) => Array.from(new Map(values.map(v=>[JSON.stringify(v),v])).values());
  for(const c of source.cases||[]) {
    target.cases ||= [];
    const links=c.links.flatMap(l=>sourceMap.has(l.docId)?[{...l,docId:sourceMap.get(l.docId)!}]:[]);
    const existing=target.cases.find(t=>t.name===c.name&&t.kind===c.kind&&JSON.stringify(t.attributes)===JSON.stringify(c.attributes)&&t.notes===c.notes);
    if(existing) { existing.links=unique([...existing.links,...links]);caseMap.set(c.id,existing.id); }
    else {const id=uid('case');target.cases.push({...c,id,attributes:{...c.attributes},links});caseMap.set(c.id,id);}
  }
  for(const g of source.groups||[]) {
    target.groups ||= [];const memberIds=mapped(g.memberIds,g.kind==='codes'?codes:sourceMap);
    const existing=target.groups.find(t=>t.name===g.name&&t.kind===g.kind);
    if(existing){existing.memberIds=unique([...existing.memberIds,...memberIds]);groupMap.set(g.id,existing.id);}
    else{const id=uid('group');target.groups.push({...g,id,memberIds});groupMap.set(g.id,id);}
  }
  for(const a of source.annotations||[]) {
    if (!docs.has(a.docId)) continue;
    target.annotations ||= [];const value={...a,docId:docs.get(a.docId)!};
    if(!target.annotations.some(t=>t.docId===value.docId&&t.start===a.start&&t.end===a.end&&t.note===a.note&&t.author===a.author))target.annotations.push({...value,id:uid('annotation')});
  }
  for(const m of source.memos||[]) {
    target.memos ||= [];const value={...m,docIds:mapped(m.docIds,sourceMap),codeIds:mapped(m.codeIds,codes),caseIds:mapped(m.caseIds,caseMap),segmentIds:mapped(m.segmentIds,excerptMap)};
    if(!target.memos.some(t=>JSON.stringify({...t,id:undefined})===JSON.stringify({...value,id:undefined})))target.memos.push({...value,id:uid('memo')});
  }
  for(const q of source.queries||[]) {
    target.queries ||= [];const value={...q,codeIds:mapped(q.codeIds,codes),excludeCodeIds:mapped(q.excludeCodeIds,codes),codeGroupIds:mapped(q.codeGroupIds,groupMap),docIds:mapped(q.docIds,sourceMap),documentGroupIds:mapped(q.documentGroupIds,groupMap),caseIds:mapped(q.caseIds,caseMap)};
    // Dropping a scoped or excluded filter must not silently broaden results.
    const references: [string[], Map<string,string>][] = [[q.codeIds,codes],[q.excludeCodeIds,codes],[q.codeGroupIds,groupMap],[q.docIds,sourceMap],[q.documentGroupIds,groupMap],[q.caseIds,caseMap]];
    if (references.some(([ids,map])=>ids.some(id=>!map.has(id)))) value.needsScopeReview=true;
    if(!target.queries.some(t=>JSON.stringify({...t,id:undefined})===JSON.stringify({...value,id:undefined})))target.queries.push({...value,id:uid('query')});
  }
}
