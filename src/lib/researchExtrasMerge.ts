import {Project,uid} from '../domain';
import {validateDemographicTable} from './demographicTable';
import {icrStatistics} from './icrStatistics';
import {comparisonMethods} from './icrComparisons';
/** Import analysis snapshots without overwriting the destination's working canvas. */
export function mergeResearchExtras(target:Project,source:Project,refs:Map<string,string>,includeSourceSummaries=false) {
  for(const table of source.demographicTables||[])validateDemographicTable(table);
  const settingsValid=(value:any)=>value&&Object.prototype.hasOwnProperty.call(comparisonMethods,value.method)&&Array.isArray(value.codeIds)&&value.codeIds.every((id:any)=>typeof id==='string')&&Array.isArray(value.domains)&&value.domains.every((d:any)=>d&&typeof d.name==='string'&&Array.isArray(d.codeIds))&&Array.isArray(value.training);
  if(source.icrComparison&&!settingsValid(source.icrComparison))throw Error('Invalid imported ICR comparison settings.');
  if(source.icrSetups?.some(s=>!s||typeof s.name!=='string'||!settingsValid(s.settings)))throw Error('Invalid imported ICR setup.');
  for(const run of source.icrRuns||[]){
    if(!run||typeof run.id!=='string'||typeof run.name!=='string'||typeof run.fingerprint!=='string'||!Number.isFinite(run.createdAt)||!run.scope||!Array.isArray(run.scope.docIds)||!Array.isArray(run.coders)||!Array.isArray(run.reviewed)||!run.result||typeof run.result.text!=='string'||typeof run.result.description!=='string'||!Array.isArray(run.result.warnings)||!Array.isArray(run.result.rows)||run.result.rows.some(r=>!r||!Object.prototype.hasOwnProperty.call(icrStatistics,r.statistic)||typeof r.label!=='string'||!Number.isFinite(r.items)||r.kappa!==null&&!Number.isFinite(r.kappa)))throw Error('Invalid imported ICR run. The original project was not changed.');
  }
  const idKeys=new Set(['id','docId','sourceId','imageId','codeId','codeAId','codeBId','caseId','memoId','fromCodeId','toCodeId','fromAnnotationId','toAnnotationId']);
  const listKeys=new Set(['folderIds','groupIds','resolvedDocIds','docIds','codeIds','caseIds','segmentIds','excerptIds','hiddenIds','rootIds','sourceIds','sourceDocIds','sourceCodeIds','excludeCodeIds','codeGroupIds','documentGroupIds']);
  const remap=(value:any,key=''):any=>{
    if(typeof value==='string')return idKeys.has(key)||listKeys.has(key)?refs.get(value)||value:value;
    if(Array.isArray(value))return value.map(v=>remap(v,key));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[(['docPeriods','segmentPeriods'].includes(key)?refs.get(k)||k:k),remap(v,k)]));
    return value;
  };
  for(const key of ['demographicTables','icrRuns','reviewedSources','caseFrameworkCells','frameworkCells','relationNotes','mapDrafts','visualizationNotes'] as const){
    if((key==='frameworkCells'||key==='relationNotes')&&!includeSourceSummaries)continue;
    const incoming=source[key];if(!incoming?.length)continue;
    const dest=(target[key]||[]) as any[],same=(v:any)=>JSON.stringify({...v,id:undefined});
    for(const original of incoming){const value=remap(original);if(!dest.some(d=>same(d)===same(value)))dest.push({...value,...('id'in value?{id:uid(key)}:{})});}
    (target as any)[key]=dest;
  }
  // Historical runs retain their data fingerprint and values. Remapping source
  // identities intentionally makes them historical in the receiving project.
  if(source.icrComparison){const setup=remap(source.icrComparison);if(!target.icrComparison)target.icrComparison=setup;else if(JSON.stringify(target.icrComparison)!==JSON.stringify(setup)){
    target.icrSetups||=[];if(!target.icrSetups.some(s=>JSON.stringify(s.settings)===JSON.stringify(setup)))target.icrSetups.push({id:uid('icr-setup'),name:'Imported from '+source.name,settings:setup});
  }}
  for(const setup of source.icrSetups||[]){const settings=remap(setup.settings);target.icrSetups||=[];if(!target.icrSetups.some(s=>JSON.stringify(s.settings)===JSON.stringify(settings)))target.icrSetups.push({...setup,id:uid('icr-setup'),settings});}
  for(const resolution of source.icrResolutions||[]){const value=remap(resolution);target.icrResolutions||=[];if(!target.icrResolutions.some(r=>JSON.stringify({...r,id:undefined})===JSON.stringify({...value,id:undefined})))target.icrResolutions.push({...value,id:uid('resolution')});}
}
