import {Project,ResearchCase} from '../domain';
export interface DemographicScope {folderIds:string[];docIds:string[];groupIds:string[]}
export function demographicSourceIds(project:Project,scope:DemographicScope):Set<string>|null {
  if(!scope.folderIds.length&&!scope.docIds.length&&!scope.groupIds.length)return null;
  const folders=new Set(scope.folderIds),sources=new Set(scope.docIds);
  // Include nested folders; a set prevents cycles and duplicate membership.
  let changed=true;while(changed){changed=false;for(const f of project.folders)if(f.parentId&&folders.has(f.parentId)&&!folders.has(f.id)){folders.add(f.id);changed=true;}}
  for(const source of [...project.docs,...(project.images||[])])if(source.folderId&&folders.has(source.folderId))sources.add(source.id);
  for(const group of project.groups||[])if(group.kind==='documents'&&scope.groupIds.includes(group.id))for(const id of group.memberIds)sources.add(id);
  return sources;
}
export function demographicCases(project:Project,scope:DemographicScope):ResearchCase[] {
  const sources=demographicSourceIds(project,scope);
  return sources===null?project.cases||[]:(project.cases||[]).filter(c=>c.links.some(link=>sources.has(link.docId)));
}
export function demographicSummary(cases:ResearchCase[],attributes:string[]) {
  return attributes.flatMap(attribute=>{
    const counts=new Map<string|null,number>();
    for(const c of cases){const value=c.attributes[attribute]?.trim()||null;counts.set(value,(counts.get(value)||0)+1);}
    return [...counts].sort(([a],[b])=>a===null?1:b===null?-1:a.localeCompare(b,undefined,{numeric:true})).map(([value,n])=>({attribute,value:value??'Not recorded',missing:value===null,n,percent:cases.length?n/cases.length*100:0}));
  });
}
