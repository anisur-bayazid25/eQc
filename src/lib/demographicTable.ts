import {Project,ResearchCase,uid} from '../domain';
import {DemographicScope,demographicCases} from './demographics';

export type DemographicPreset='sections'|'variables'|'comparison'|'profiles';
export interface DemographicField {
  key:string;label:string;mode:'categories'|'bands'|'numeric';statistic:'mean-sd'|'median-iqr'|'min-max';
  categories:Array<{id:string;label:string;values:string[]}>;
  bands:Array<{id:string;label:string;min?:number;max?:number;includeMin?:boolean;includeMax?:boolean}>;
}
export interface DemographicTableDraft {
  id:string;name:string;title:string;subtitle:string;note:string;updatedAt:number;
  scope:DemographicScope;resolvedDocIds?:string[];preset:DemographicPreset;
  fields:DemographicField[];format:'separate'|'combined'|'count'|'percent';base:'all'|'valid';decimals:number;showMissing:boolean;showTotal:boolean;
  style:'minimal'|'banded'|'grid';font:'serif'|'sans';fontSize:number;
  groupBy:string;customGroups:Array<{id:string;label:string;caseIds:string[]}>;
  labels:{variable:string;category:string;count:string;percent:string;total:string};
  missingValues?:string[];
}
export function defaultDemographicTable(project:Project):DemographicTableDraft {
  const keys=Array.from(new Set((project.cases||[]).flatMap(c=>Object.keys(c.attributes)))).sort();
  const preferred=keys.filter(k=>/^(age|gender|sex|occupation|location|education|marital status)$/i.test(k));
  return {id:uid('demographic-table'),name:'Participant characteristics',title:'Table 1. Participant characteristics',subtitle:'',note:'',updatedAt:Date.now(),scope:{folderIds:[],docIds:[],groupIds:[]},preset:'sections',fields:(preferred.length?preferred:keys).slice(0,4).map(defaultDemographicField),format:'separate',base:'all',decimals:1,showMissing:true,showTotal:true,style:'minimal',font:'serif',fontSize:11,groupBy:'',customGroups:[],missingValues:['Not reported','Not recorded','Not verified','Unknown','Missing','N/A','NA'],labels:{variable:'Characteristic',category:'Category',count:'N',percent:'%',total:'Total'}};
}
export function defaultDemographicField(key:string):DemographicField {return {key,label:key,mode:'categories',statistic:'mean-sd',categories:[],bands:[]};}
export function demographicNumber(raw:string|undefined):number|undefined {
  const text=(raw||'').trim().replace(/[০-৯]/g,c=>String(c.charCodeAt(0)-'০'.charCodeAt(0)));
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text))return undefined;
  const value=Number(text);return Number.isFinite(value)?value:undefined;
}
export function numericDemographics(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  if(!n)return {n:0,mean:null,sd:null,median:null,q1:null,q3:null,min:null,max:null};
  let mean=0,m2=0;values.forEach((v,i)=>{const delta=v-mean;mean+=delta/(i+1);m2+=delta*(v-mean);});
  const quantile=(p:number)=>{const index=(n-1)*p,lower=Math.floor(index);return sorted[lower]+(sorted[Math.min(n-1,lower+1)]-sorted[lower])*(index-lower);};
  return {n,mean,sd:n>1?Math.sqrt(Math.max(0,m2/(n-1))):null,median:quantile(.5),q1:quantile(.25),q3:quantile(.75),min:sorted[0],max:sorted[n-1]};
}
export function makeDemographicBands(values:number[],width:number) {
  if(!Number.isFinite(width)||width<=0)throw Error('Choose a positive band width.');
  if(!values.length)throw Error('No numeric values are available for bands.');
  const min=Math.floor(Math.min(...values)/width)*width,max=(Math.floor(Math.max(...values)/width)+1)*width,count=Math.round((max-min)/width);
  if(!Number.isFinite(count)||count>50)throw Error('Choose a wider interval to create at most 50 bands.');
  return Array.from({length:count},(_,i)=>{const start=+(min+i*width).toPrecision(12),end=+(min+(i+1)*width).toPrecision(12);return {id:uid('band'),label:`${start}–<${end}`,min:start,max:end};});
}
export type DemographicOperator='gt'|'gte'|'lt'|'lte'|'eq'|'between';
export function makeDemographicRule(operator:DemographicOperator,x:number,y?:number,includeMin=true,includeMax=true):DemographicField['bands'][number] {
  if(!Number.isFinite(x)||operator==='between'&&(!Number.isFinite(y)||x>=y!))throw Error('Enter valid numbers; a range must end above its starting value.');
  const base={id:uid('band')};
  switch(operator){
    case 'gt':return {...base,label:`> ${x}`,min:x,includeMin:false};
    case 'gte':return {...base,label:`≥ ${x}`,min:x};
    case 'lt':return {...base,label:`< ${x}`,max:x};
    case 'lte':return {...base,label:`≤ ${x}`,max:x,includeMax:true};
    case 'eq':return {...base,label:`= ${x}`,min:x,max:x,includeMax:true};
    case 'between':return {...base,label:`${includeMin?'[':'('}${x}, ${y}${includeMax?']':')'}`,min:x,max:y,includeMin,includeMax};
    default:throw Error('Choose a numeric comparison.');
  }
}
export function demographicBandMatches(value:number,band:DemographicField['bands'][number]) {
  return (band.min===undefined||value>band.min||value===band.min&&band.includeMin!==false)&&(band.max===undefined||value<band.max||value===band.max&&band.includeMax===true);
}
function bandsOverlap(a:DemographicField['bands'][number],b:DemographicField['bands'][number]) {
  const lo=Math.max(a.min??-Infinity,b.min??-Infinity),hi=Math.min(a.max??Infinity,b.max??Infinity);
  return lo<hi||lo===hi&&demographicBandMatches(lo,a)&&demographicBandMatches(lo,b);
}
export function validateDemographicTable(draft:DemographicTableDraft) {
  if(!draft||!Array.isArray(draft.fields)||!draft.scope||!['sections','variables','comparison','profiles'].includes(draft.preset)||!Array.isArray(draft.customGroups)||!draft.labels)throw Error('Invalid demographic table draft.');
  if(!['separate','combined','count','percent'].includes(draft.format)||!['all','valid'].includes(draft.base)||!['minimal','banded','grid'].includes(draft.style)||!Number.isInteger(draft.decimals)||draft.decimals<0||draft.decimals>3||draft.fontSize<8||draft.fontSize>18)throw Error('Invalid demographic table format.');
  if(!['serif','sans'].includes(draft.font)||Object.values(draft.labels).some(v=>typeof v!=='string')||draft.missingValues?.some(v=>typeof v!=='string')||draft.resolvedDocIds&&!Array.isArray(draft.resolvedDocIds))throw Error('Invalid demographic labels or source references.');
  for(const values of [draft.scope.docIds,draft.scope.folderIds,draft.scope.groupIds])if(!Array.isArray(values)||values.some(v=>typeof v!=='string'))throw Error('Invalid demographic source selection.');
  for(const field of draft.fields){
    if(typeof field.key!=='string'||!field.label?.trim()||!Array.isArray(field.categories)||!Array.isArray(field.bands)||!['categories','bands','numeric'].includes(field.mode)||!['mean-sd','median-iqr','min-max'].includes(field.statistic))throw Error('Invalid demographic variable.');
    const assigned=new Set<string>();for(const category of field.categories){if(!category.label.trim()||!Array.isArray(category.values))throw Error('Name each category group.');for(const value of category.values){if(assigned.has(value))throw Error('A source category cannot belong to two groups.');assigned.add(value);}}
    if(field.bands.length>50)throw Error('Use at most 50 numeric bands per variable.');
    for(let i=0;i<field.bands.length;i++){const band=field.bands[i],lo=band.min??-Infinity,hi=band.max??Infinity;if(!band.label.trim()||lo>hi||lo===hi&&!demographicBandMatches(lo,band)||band.min!==undefined&&!Number.isFinite(band.min)||band.max!==undefined&&!Number.isFinite(band.max)||band.includeMin!==undefined&&typeof band.includeMin!=='boolean'||band.includeMax!==undefined&&typeof band.includeMax!=='boolean')throw Error('Numeric rules need a label and valid bounds. Equal bounds must include the value.');for(let j=0;j<i;j++)if(bandsOverlap(band,field.bands[j]))throw Error('Numeric rules must not overlap. Adjust the bounds or include/exclude options so each value belongs to one group.');}
  }
  for(const group of draft.customGroups)if(!group.label.trim()||!Array.isArray(group.caseIds)||group.caseIds.some(id=>typeof id!=='string'))throw Error('Name each comparison group and select valid case IDs.');
}
export function loadDemographicTable(project:Project,draft:DemographicTableDraft):DemographicTableDraft {
  validateDemographicTable(draft);const next=structuredClone(draft);
  const known=new Set(project.folders.map(f=>f.id));
  if(next.scope.folderIds.some(id=>!known.has(id))&&next.resolvedDocIds?.length){next.scope.docIds=Array.from(new Set([...next.scope.docIds,...next.resolvedDocIds]));next.scope.folderIds=next.scope.folderIds.filter(id=>known.has(id));}
  return next;
}
export interface DemographicCell {n:number;percent:number|null;text?:string;}
export interface DemographicSection {key:string;label:string;rows:Array<{key:string;label:string;kind:'category'|'missing'|'statistic';cells:DemographicCell[]}>}
export function buildDemographicTable(project:Project,draft:DemographicTableDraft) {
  validateDemographicTable(draft);
  const cases=demographicCases(project,draft.scope),groups:Array<{id:string;label:string;cases:ResearchCase[]}>=[];
  const missing=new Set((draft.missingValues||[]).map(v=>v.trim().toLocaleLowerCase()));
  const rawValue=(c:ResearchCase,key:string)=>{const value=c.attributes[key]?.trim()||'';return missing.has(value.toLocaleLowerCase())?'':value;};
  if(draft.preset==='comparison'&&draft.groupBy==='__custom'){
    for(const group of draft.customGroups){const ids=new Set(group.caseIds);groups.push({id:group.id,label:group.label,cases:cases.filter(c=>ids.has(c.id))});}
  }else if(draft.preset==='comparison'&&draft.groupBy){
    const values=Array.from(new Set(cases.map(c=>rawValue(c,draft.groupBy)))).sort();
    for(const value of values)groups.push({id:value||'__missing',label:value||'Not recorded',cases:cases.filter(c=>rawValue(c,draft.groupBy)===value)});
  }else groups.push({id:'all',label:'All participants',cases});
  const f=(n:number|null)=>n===null?'—':n.toFixed(draft.decimals);
  const sections:DemographicSection[]=draft.fields.map(field=>{
    if(field.mode==='numeric'){
      const numeric=groups.map(g=>numericDemographics(g.cases.flatMap(c=>{const value=demographicNumber(rawValue(c,field.key));return value===undefined?[]:[value];})));
      const label=field.statistic==='mean-sd'?'Mean (SD)':field.statistic==='median-iqr'?'Median (Q1–Q3)':'Minimum–maximum';
      const cells=numeric.map(s=>({n:s.n,percent:null,text:field.statistic==='mean-sd'?`${f(s.mean)} (${f(s.sd)})`:field.statistic==='median-iqr'?`${f(s.median)} (${f(s.q1)}–${f(s.q3)})`:`${f(s.min)}–${f(s.max)}`}));
      const rows:DemographicSection['rows']=[{key:'stat',label,kind:'statistic',cells}];
      if(draft.showMissing)rows.push({key:'missing',label:'Not recorded / non-numeric',kind:'missing',cells:groups.map((g,i)=>({n:g.cases.length-numeric[i].n,percent:draft.base==='all'&&g.cases.length?(g.cases.length-numeric[i].n)/g.cases.length*100:null}))});
      return {key:field.key,label:field.label,rows};
    }
    const category=(c:ResearchCase)=>{
      const raw=rawValue(c,field.key);if(!raw)return null;
      if(field.mode==='bands'){const value=demographicNumber(raw);if(value===undefined)return null;const band=field.bands.find(b=>demographicBandMatches(value,b));return band?{key:band.id,label:band.label}:{key:'__other',label:'Other values'};}
      const group=field.categories.find(g=>g.values.includes(raw));return group?{key:group.id,label:group.label}:{key:'value:'+raw,label:raw};
    };
    const levels=new Map<string,string>();
    for(const level of field.mode==='bands'?field.bands:field.categories)levels.set(level.id,level.label);
    for(const value of cases.map(category).filter((v):v is {key:string;label:string}=>v!==null).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true})))if(!levels.has(value.key))levels.set(value.key,value.label);
    const valid=groups.map(g=>g.cases.filter(c=>category(c)!==null).length);
    const rows:DemographicSection['rows']=Array.from(levels,([key,label])=>({key,label,kind:'category' as const,cells:groups.map((g,i)=>{const n=g.cases.filter(c=>category(c)?.key===key).length,base=draft.base==='all'?g.cases.length:valid[i];return {n,percent:base?n/base*100:null};})}));
    if(draft.showMissing&&cases.some(c=>category(c)===null))rows.push({key:'missing',label:'Not recorded',kind:'missing',cells:groups.map((g,i)=>({n:g.cases.length-valid[i],percent:draft.base==='all'&&g.cases.length?(g.cases.length-valid[i])/g.cases.length*100:null}))});
    return {key:field.key,label:field.label,rows};
  });
  const numeric=draft.fields.some(f=>f.mode==='numeric'),notes=[draft.base==='all'?'Percentages use all cases in each column, including missing values.':'Percentages use non-missing values for each variable; missing rows have no percentage.',...(numeric?['Numeric summaries use valid numeric values; SD uses n−1. Quartiles use linear interpolation (R7).']:[]),...(draft.preset==='comparison'&&draft.groupBy==='__custom'?['Comparison groups may overlap; cases count once within each group.']:[]),...(draft.fields.some(f=>f.mode==='bands')?['Numeric categories use the configured bounds. [ ] include an endpoint; ( ) exclude it. Unmatched numeric values appear in Other values.']:[]),draft.note].filter(Boolean);
  return {cases,groups,sections,notes};
}
export function demographicCellText(cell:DemographicCell,format:DemographicTableDraft['format'],decimals:number):string[] {
  if(cell.text)return format==='separate'?[String(cell.n),cell.text]:[`${cell.text}; n=${cell.n}`];
  const percent=cell.percent===null?'—':cell.percent.toFixed(decimals);
  return format==='separate'?[String(cell.n),percent]:format==='count'?[String(cell.n)]:format==='percent'?[percent==='—'?percent:percent+'%']:[`${cell.n} (${percent==='—'?percent:percent+'%'})`];
}
