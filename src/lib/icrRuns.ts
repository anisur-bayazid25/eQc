import {Project,normalizeCoderName,uid} from '../domain';
import {collectIcrCoders,computePairwiseIcr,computeBinaryAlpha,computeFleissIcr,IcrScope} from './icr';
import {ComparisonResult,computeComparison,IcrComparisonSettings} from './icrComparisons';
import {buildIcrSummary} from './icrSummary';
export interface IcrRun {id:string;name:string;createdAt:number;fingerprint:string;method:'source'|'comparison';coders:string[];scope:IcrScope;settings?:IcrComparisonSettings;sources:Array<{id:string;name:string}>;codes:Array<{id:string;name:string}>;result:ComparisonResult;reviewed:Array<{sourceId:string;coder:string;reviewedAt:number}>;}
/** UI movement, memos and graph styling do not invalidate research calculations. */
export function icrFingerprint(project:Project):string {
  const data=JSON.stringify([project.docs.map(d=>[d.id,d.content]),project.images?.map(i=>i.id),project.codes.map(c=>c.id),project.codedSegments.map(s=>[s.id,s.docId,s.codeId,s.start,s.end,normalizeCoderName(s.coder)]),project.codedRegions?.map(r=>[r.id,r.imageId,r.codeId,r.x,r.y,r.width,r.height,normalizeCoderName(r.coder)])]);
  let hash=2166136261;for(let i=0;i<data.length;i++){hash^=data.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16)+':'+data.length;
}
export function captureIcrRun(project:Project,name:string,coders:string[],scope:IcrScope,method:'source'|'comparison',settings=project.icrComparison):IcrRun {
  if(!name.trim())throw Error('Name this ICR run.');
  coders=Array.from(new Set(coders.map(normalizeCoderName))).filter(c=>c!=='Unattributed');
  let result:ComparisonResult;
  if(method==='comparison'){
    if(!settings)throw Error('Calculate and save the comparison settings first.');
    if(settings.method==='training')coders=settings.trainingCoders??Array.from(new Set(settings.training.map(r=>normalizeCoderName(r.coder))));
    result=computeComparison(project,coders,scope,settings);
  }else{
    const summary=buildIcrSummary(project,coders,scope);if(!summary.available)throw Error(summary.warnings.join(' '));
    const rows:ComparisonResult['rows']=[];
    for(let i=0;i<coders.length;i++)for(let j=i+1;j<coders.length;j++){
      const pair=computePairwiseIcr(project,coders[i],coders[j],scope);
      rows.push({statistic:'cohen',role:'total',label:`${coders[i]} / ${coders[j]}`,items:pair.items,agreement:pair.percent,contingency:{...pair.contingency},kappa:pair.kappa,holsti:pair.holsti});
      for(const c of pair.perCode)rows.push({statistic:'cohen',role:'code',label:`${coders[i]} / ${coders[j]} — ${c.codeName}`,items:c.n,agreement:c.percent,contingency:{bothYes:c.bothYes,aOnly:c.aOnly,bOnly:c.bOnly,bothNo:c.bothNo,n:c.n},kappa:c.kappa,holsti:c.holsti});
    }
    const binary=computeBinaryAlpha(project,coders,scope);rows.push({statistic:'binary',role:'global',label:'All coders',items:binary.items,agreement:null,kappa:binary.alpha});
    if(coders.length>=3){const f=computeFleissIcr(project,coders,scope);rows.push({statistic:'fleiss',role:'global',label:'All coders',items:f.items,agreement:f.percentFull,kappa:f.kappa});}
    result={title:'Source-level code presence',description:'One source × direct code is a binary present/absent item.',rows,text:summary.text,warnings:summary.warnings};
  }
  if(!result.rows.some(row=>row.items>0))throw Error('No comparable items are available for this run.');
  return structuredClone({sources:[...project.docs.filter(d=>scope.docIds.includes(d.id)),...(scope.includeImages?project.images||[]:[])].map(({id,name})=>({id,name})),codes:project.codes.filter(c=>method==='source'||settings?.codeIds.includes(c.id)).map(({id,name})=>({id,name})),id:uid('icr-run'),name:name.trim(),createdAt:Date.now(),fingerprint:icrFingerprint(project),method,coders,scope,...(method==='comparison'?{settings}:{}),result,reviewed:project.reviewedSources||[]});
}
export function sourceDisagreements(project:Project,coderA:string,coderB:string,scope:IcrScope) {
  if(!coderA||!coderB||coderA===coderB)return [];
  const a=normalizeCoderName(coderA),b=normalizeCoderName(coderB);
  const sources=new Map([...project.docs.filter(d=>scope.docIds.includes(d.id)),...(scope.includeImages?project.images||[]:[])].map(s=>[s.id,s]));
  const codes=new Map(project.codes.map(c=>[c.id,c]));
  const grouped=new Map<string,{sourceId:string;codeId:string;entries:Array<Project['codedSegments'][number]|NonNullable<Project['codedRegions']>[number]>}>();
  for(const entry of [...project.codedSegments,...(project.codedRegions||[])]){
    const sourceId='docId'in entry?entry.docId:entry.imageId;
    if(!sources.has(sourceId)||!codes.has(entry.codeId)||![a,b].includes(normalizeCoderName(entry.coder)))continue;
    const key=JSON.stringify([sourceId,entry.codeId]),group=grouped.get(key)||{sourceId,codeId:entry.codeId,entries:[]};group.entries.push(entry);grouped.set(key,group);
  }
  return Array.from(grouped.values()).flatMap(({sourceId,codeId,entries})=>{
    const signatures=(coder:string)=>Array.from(new Set(entries.filter(s=>normalizeCoderName(s.coder)===coder).map(s=>'start'in s?JSON.stringify([s.start,s.end]):JSON.stringify([s.x,s.y,s.width,s.height])))).sort();
    const aa=signatures(a),bb=signatures(b);if(JSON.stringify(aa)===JSON.stringify(bb))return [];
    return [{sourceId,sourceName:sources.get(sourceId)!.name,codeId,codeName:codes.get(codeId)!.name,coderA:a,coderB:b,entries,kind:!!aa.length!==!!bb.length?'Code presence differs':'Coding boundaries or regions differ'}];
  });
}
