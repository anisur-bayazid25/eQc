import React from 'react';
import type {MapAnnotation,SourceDoc} from '../domain';
export default function CooccurrenceEvidence({annotation,docs,onOpenDocument}:{annotation:MapAnnotation;docs:SourceDoc[];onOpenDocument?:(id:string)=>void}){
 const pair=annotation.coocPair;if(!pair)return null;
 return <section className="cooccurrence-evidence" aria-label="Co-occurrence evidence"><strong>Relationship count: {pair.value}</strong><p>{pair.unit==='documents'?'Shared text documents; each document contributes once.':'Overlapping coding-range pairs. Different pairs can share the same excerpt.'}</p>
 {pair.ranges.length>0&&<details open><summary>Supporting overlaps (up to 30 distinct ranges)</summary>{pair.ranges.map((range,i)=>{const doc=docs.find(d=>d.id===range.docId);return doc?<article key={i}><button onClick={()=>onOpenDocument?.(doc.id)}>{doc.name}</button><blockquote>{doc.content.slice(range.start,range.end)||'Source text has changed; regenerate this figure.'}</blockquote></article>:<p key={i}>Source no longer available.</p>;})}</details>}
 <small>This is a saved calculation. Regenerate after changing coding; excerpts display the current source text.</small></section>;
}
