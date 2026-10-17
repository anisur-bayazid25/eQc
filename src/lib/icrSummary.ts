import {Project} from '../domain';
import {collectIcrCoders,computeBinaryAlpha,computeFleissIcr,computePairwiseIcr,formatIcrValue,IcrScope,icrCoderName} from './icr';
import {computeComparison} from './icrComparisons';

export function buildReportingIcrSummary(project:Project,coders?:string[],scope?:IcrScope,method:'source'|'comparison'='source') {
  if(method==='source')return buildIcrSummary(project,coders,scope);
  const names=coders??collectIcrCoders(project).attributed.map(c=>c.name),effectiveScope=scope??{docIds:project.docs.map(d=>d.id),includeImages:true};
  try{if(!project.icrComparison)throw Error('Calculate and save an additional comparison in Analysis → ICR first.');const result=computeComparison(project,names,effectiveScope,project.icrComparison);if(!result.rows.some(row=>row.items>0))throw Error('No comparison items are available in this scope.');return {available:true,text:result.text,coders:names,scope:effectiveScope,warnings:result.warnings};}
  catch(error){return {available:false,text:'',coders:names,scope:effectiveScope,warnings:[error instanceof Error?error.message:String(error)]};}
}

export function buildIcrSummary(project:Project,coderNames?:string[],requestedScope?:IcrScope) {
  const inventory=collectIcrCoders(project),available=inventory.attributed.map(c=>c.name);
  const coders=Array.from(new Set(coderNames??available)).filter(c=>available.includes(c));
  const scope=requestedScope??{docIds:project.docs.map(d=>d.id),includeImages:true};
  const docIds=Array.from(new Set(scope.docIds)).filter(id=>project.docs.some(d=>d.id===id));
  const effectiveScope={...scope,docIds};
  const sourceIds=[...docIds,...(scope.includeImages?(project.images||[]).map(i=>i.id):[])];
  const warnings:string[]=[];
  if(coders.length<2||!sourceIds.length||!project.codes.length)return {available:false,text:'',coders,scope:effectiveScope,warnings:['At least two attributed coders, one source and one code are required.']};
  const binary=computeBinaryAlpha(project,coders,effectiveScope);
  const pairs=coders.flatMap((a,i)=>coders.slice(i+1).map(b=>computePairwiseIcr(project,a,b,effectiveScope)));
  const fleiss=coders.length>=3?computeFleissIcr(project,coders,effectiveScope):null;
  const range=(values:Array<number|null>,digits=3)=>{const defined=values.filter((v):v is number=>v!==null&&Number.isFinite(v));return defined.length?(Math.min(...defined)===Math.max(...defined)?Math.min(...defined).toFixed(digits):Math.min(...defined).toFixed(digits)+'–'+Math.max(...defined).toFixed(digits)):'undefined';};
  const imageCount=scope.includeImages?(project.images||[]).length:0;
  const sourcesText=[docIds.length?`${docIds.length} text document${docIds.length===1?'':'s'}`:'',imageCount?`${imageCount} image source${imageCount===1?'':'s'}`:''].filter(Boolean).join(' and ');
  let text=`Intercoder agreement was calculated in eQc for ${coders.length} attributed coders across ${sourcesText}, using ${project.codes.length} direct codes. Each of the ${binary.items} comparison items was a source × code pair, rated present if a coder applied that code at least once and absent otherwise; repeated applications did not increase the rating. Krippendorff’s nominal α across these binary ratings was ${binary.alpha===null?'undefined':formatIcrValue(binary.alpha)}.`;
  if(fleiss)text+=` Fleiss’ κ was ${fleiss.kappa===null?'undefined':formatIcrValue(fleiss.kappa)}, with ${fleiss.percentFull.toFixed(1)}% full agreement across all ${coders.length} coders.`;
  if(pairs.length===1){const pair=pairs[0];text+=` Observed agreement was ${pair.percent.toFixed(1)}%; Cohen’s κ was ${pair.kappa===null?'undefined':formatIcrValue(pair.kappa)} and the positive-decision Holsti index was ${pair.holsti===null?'undefined':formatIcrValue(pair.holsti)}.`;}
  else text+=` Across all ${pairs.length} coder pairs, observed agreement ranged from ${range(pairs.map(p=>p.percent),1)}%, Cohen’s κ from ${range(pairs.map(p=>p.kappa))}, and the positive-decision Holsti index from ${range(pairs.map(p=>p.holsti))}. Ranges exclude undefined coefficients (${pairs.filter(p=>p.kappa===null).length} undefined κ; ${pairs.filter(p=>p.holsti===null).length} undefined Holsti).`;
  text+=' Observed agreement includes joint absences; Holsti excludes them. These are source-level coding-presence statistics, not passage-boundary agreement.';
  if(inventory.unattributed){text+=' Unattributed coding entries were excluded.';warnings.push('Unattributed entries are excluded; coder identities come from the coding records.');}
  const entries=[...project.codedSegments.map(s=>({coder:s.coder,source:s.docId})),...(project.codedRegions||[]).map(r=>({coder:r.coder,source:r.imageId}))];
  const missing=sourceIds.filter(id=>coders.some(coder=>!entries.some(e=>e.source===id&&icrCoderName(e.coder)===coder)));
  warnings.push('An absent code is treated as a negative rating. The app cannot tell an uncoded source from an unreviewed source. Confirm that every selected coder reviewed the comparison sources.');
  if(missing.length)warnings.push(`${missing.length} included sources have no coding entries from at least one selected coder. Narrow the scope if those sources were not reviewed by everyone.`);
  if(binary.alpha===null)warnings.push('Nominal alpha is undefined for this scope (for example, no variation). Undefined coefficients are never reported as zero.');
  return {available:true,text,coders,scope:effectiveScope,warnings};
}
