import {normalizeCoderName} from '../domain';
import React,{useId,useMemo} from 'react';
import StatisticalSettings from './StatisticalSettings';
import VisualizationLimit from './VisualizationLimit';
import {statisticalReadiness} from '../lib/statisticalVisualizations';
import type {VisualizationData,VisualizationOptions} from '../lib/visualizations';

export default function StatisticalWorkflow({family,data,options:o,onChange,returnToCanvas,onBack,onGenerate,error}:{family:'histomap'|'dendrogram';data:VisualizationData;options:VisualizationOptions;onChange:(p:Partial<VisualizationOptions>)=>void;returnToCanvas?:boolean;onBack:()=>void;onGenerate:()=>void;error:string}){
 const id=useId(),name=family==='histomap'?'Histomap':'Dendrogram',readiness=useMemo(()=>statisticalReadiness(data,family,o),[data.docs,data.codes,data.codedSegments,data.analysisPeriods,family,o.codeIds,o.docIds,o.limit,o.docLimit,o.coder,o.periods,o.docPeriods,o.segmentPeriods,o.preset]);
 const coders=Array.from(new Set(data.codedSegments.map(s=>normalizeCoderName(s.coder))));
 return <section className="visualization-setup statistical-workflow" aria-label={name+' settings'}>
  <header><button onClick={onBack}>{returnToCanvas?'← Back to visualization':'← All visualizations'}</button><h2>{name}</h2></header>
  <nav className="statistical-steps" aria-label={name+' setup steps'}><a href={'#'+id+'-prepare'}>1. Prepare data</a><span aria-hidden="true">→</span><a href={'#'+id+'-display'}>2. Choose display</a><span aria-hidden="true">→</span><a href={'#'+id+'-generate'}>3. Generate</a></nav>
  <div className={'statistical-readiness '+(readiness.ready?'is-ready':'needs-data')} role="status" aria-live="polite" aria-atomic="true" aria-label={name+' readiness'}>
   <strong>{readiness.ready?'Ready to generate':'More information needed'}</strong>{readiness.summary&&<p>{readiness.summary}</p>}
   {readiness.issues.length>0&&<ul>{readiness.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}
   {readiness.warnings.length>0&&<details><summary>Review exclusions and gaps ({readiness.warnings.length})</summary><ul>{readiness.warnings.map(warning=><li key={warning}>{warning}</li>)}</ul></details>}
  </div>
  <section className="statistical-step" id={id+'-prepare'} aria-labelledby={id+'-prepare-title'}><h3 id={id+'-prepare-title'}>1. Prepare data</h3>
   <p>{family==='histomap'?'Choose your sources and codes, then assign periods to documents or passages.':'Choose the items to compare. Similarity is calculated from your existing coding; no similarity scores need to be entered.'}</p>
   <div className="visualization-settings">
    {family==='dendrogram'&&<label>Compare<select aria-label="Visualization preset" value={o.preset} onChange={e=>onChange({preset:e.target.value})}><option value="documents">Cluster documents</option><option value="codes">Cluster codes</option></select></label>}
    <label>Coder<select aria-label="Statistical visualization coder" value={o.coder&&o.coder!=='all'?normalizeCoderName(o.coder):'all'} onChange={e=>onChange({coder:e.target.value})}><option value="all">All coders</option>{coders.map(coder=><option key={coder}>{coder}</option>)}</select></label>
    <VisualizationLimit label="Code limit" ariaLabel="Visualization item limit" max={200} value={o.limit||6} suggestions={[6,12,24,48,96,200]} onChange={limit=>onChange({limit})}/>
    <VisualizationLimit label="Document limit" ariaLabel="Visualization document limit" max={200} value={o.docLimit||24} suggestions={[4,12,24,48,100,200]} onChange={docLimit=>onChange({docLimit})}/>
   </div>
   <details><summary>Documents ({o.docIds.length} selected)</summary><p>Up to {o.docLimit||24} selected documents are used, in source order.</p><div className="research-actions"><button onClick={()=>onChange({docIds:data.docs.map(d=>d.id)})}>Select all documents</button><button onClick={()=>onChange({docIds:[]})}>Clear documents</button></div><div className="visualization-checks">{data.docs.map(d=><label key={d.id}><input type="checkbox" checked={o.docIds.includes(d.id)} onChange={e=>onChange({docIds:e.target.checked?[...o.docIds,d.id]:o.docIds.filter(id=>id!==d.id)})}/>{d.name}</label>)}</div></details>
   <details><summary>Codes ({o.codeIds.length} selected)</summary><p>Up to {o.limit} selected codes are used, in codebook order. Codes use their own coding; parent codes do not automatically include their subcodes.</p><div className="research-actions"><button onClick={()=>onChange({codeIds:data.codes.map(c=>c.id)})}>Select all codes</button><button onClick={()=>onChange({codeIds:[]})}>Clear codes</button></div><div className="visualization-checks">{data.codes.map(c=><label key={c.id}><input type="checkbox" checked={o.codeIds.includes(c.id)} onChange={e=>onChange({codeIds:e.target.checked?[...o.codeIds,c.id]:o.codeIds.filter(id=>id!==c.id)})}/>{c.name}</label>)}</div></details>
   <StatisticalSettings family={family} data={data} options={o} onChange={onChange} phase="prepare"/>
  </section>
  <section className="statistical-step" id={id+'-display'} aria-labelledby={id+'-display-title'}><h3 id={id+'-display-title'}>2. Choose display</h3>
   <div className="visualization-settings"><label>Title<input aria-label="Visualization title" value={o.title} onChange={e=>onChange({title:e.target.value})}/></label><StatisticalSettings family={family} data={data} options={o} onChange={onChange} phase="display"/></div>
  </section>
  <section className="statistical-step" id={id+'-generate'} aria-labelledby={id+'-generate-title'}><h3 id={id+'-generate-title'}>3. Generate</h3>
   <p id={id+'-generate-help'}>{readiness.ready?'Your selection is ready. Click Generate to build an editable snapshot.':'Complete the missing information listed above to enable Generate.'} Changing settings updates this readiness check only; graph generation starts when you click.</p>
   <p>Generation replaces the current canvas. Save a named draft first to keep an earlier design. Period assignments remain with this visualization and its named drafts.</p>
   {error&&<p role="alert">{error}</p>}<button className="primary-btn" disabled={!readiness.ready} aria-describedby={id+'-generate-help'} onClick={onGenerate}>Generate visualization</button>
  </section>
 </section>;
}
