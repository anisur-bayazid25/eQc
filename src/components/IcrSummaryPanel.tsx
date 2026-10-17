import React,{useMemo} from 'react';
import {Project} from '../domain';
import {IcrScope} from '../lib/icr';
import {buildReportingIcrSummary} from '../lib/icrSummary';

export default function IcrSummaryPanel({project,coders,scope,onMessage,method='source'}:{project:Project;coders?:string[];scope?:IcrScope;method?:'source'|'comparison';onMessage:(message:string)=>void}) {
  const summary=useMemo(()=>buildReportingIcrSummary(project,coders,scope,method),[project,coders,scope,method]);
  return <section className="icr-summary" aria-label="ICR paragraph preview"><h3>ICR paragraph</h3>
    <p>Uses all selected coders and every coder pair. Undefined values are stated explicitly. Verify review coverage before reporting these figures.</p>
    {summary.warnings.map(warning=><p className="section-hint" key={warning}>{warning}</p>)}
    {summary.available&&<><p className="icr-paragraph">{summary.text}</p><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(summary.text);onMessage('ICR paragraph copied.');}catch{onMessage('Clipboard unavailable. Select and copy the paragraph above.');}}}>Copy ICR paragraph</button></>}
  </section>;
}
