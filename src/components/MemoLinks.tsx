import React,{useMemo,useState} from 'react';
import {Project} from '../domain';
import {MemoRecord} from '../lib/memoTools';

export function memoLinkIndex(project:Project) {
  const docs=new Map(project.docs.map(d=>[d.id,d])),images=new Map(project.images?.map(i=>[i.id,i])),codes=new Map(project.codes.map(c=>[c.id,c])),cases=new Map(project.cases?.map(c=>[c.id,c]));
  const segments=new Map(project.codedSegments.map(s=>[s.id,s])),regions=new Map(project.codedRegions?.map(r=>[r.id,r])),codeSources=new Map<string,Set<string>>();
  for(const s of [...project.codedSegments,...(project.codedRegions||[])]){const sources=codeSources.get(s.codeId)||new Set<string>();sources.add('docId'in s?s.docId:s.imageId);codeSources.set(s.codeId,sources);}
  return {docs,images,codes,cases,segments,regions,codeSources};
}
export default function MemoLinks({memo,index,onOpen}:{memo:MemoRecord;index:ReturnType<typeof memoLinkIndex>;onOpen:(memo:MemoRecord)=>void}) {
  const [open,setOpen]=useState(false),[search,setSearch]=useState('');
  const sources=useMemo(()=>Array.from(new Set([...memo.docIds,...memo.codeIds.flatMap(id=>[...(index.codeSources.get(id)||[])])])),[memo,index]);
  const items=useMemo(()=>open?[
    ...sources.map(id=>({id,kind:index.docs.has(id)?'document':'image',name:'Source: '+(index.docs.get(id)?.name||index.images.get(id)?.name||'Unavailable source')})),
    ...memo.codeIds.map(id=>({id,kind:'code',name:'Code: '+(index.codes.get(id)?.name||'Unavailable code')})),
    ...memo.caseIds.map(id=>({id,kind:'case',name:'Case: '+(index.cases.get(id)?.name||'Unavailable case')})),
    ...memo.segmentIds.map(id=>({id,kind:index.segments.has(id)?'excerpt':'region',name:'Quote: '+(index.segments.get(id)?.text.slice(0,75)||'Image region')}))
  ]:[],[memo,index,sources,open]);
  if(!sources.length&&!memo.codeIds.length&&!memo.caseIds.length&&!memo.segmentIds.length)return null;
  return <details className="memo-linked-items" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{sources.length} sources · {memo.codeIds.length} codes · {memo.caseIds.length} cases · {memo.segmentIds.length} quotes</summary>{open&&<><input aria-label={'Find links for '+memo.title} placeholder="Find a linked source, code or case…" value={search} onChange={e=>setSearch(e.target.value)}/><div>{items.filter(i=>i.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((item,i)=><button key={item.kind+item.id+i} onClick={()=>onOpen({...memo,origin:{kind:item.kind,id:item.id}})}>{item.name}</button>)}</div></>}</details>;
}
