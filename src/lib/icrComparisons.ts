import {Project,normalizeCoderName} from '../domain';
import {cohenKappa,holstiIndex,IcrContingency,IcrScope,formatIcrValue} from './icr';

export type ComparisonMethod='presence'|'characters'|'sentences'|'paragraphs'|'segments'|'frequency'|'domains'|'training';
export interface IcrTrainingRow {unit:string;coder:string;code:string;present:boolean;rating?:number;}
export interface IcrDomain {name:string;codeIds:string[];}
export interface IcrComparisonSettings {method:ComparisonMethod;codeIds:string[];overlap:number;domains:IcrDomain[];training:IcrTrainingRow[];jointAbsences?:boolean;trainingCoders?:string[];}
export interface WeightedRatings {ratings:Array<string|null>;weight:number;}
export interface ComparisonRow {label:string;items:number;agreement:number|null;kappa:number|null;holsti?:number|null;coefficientNotApplicable?:boolean;}
export const comparisonCoefficient=(row:ComparisonRow)=>row.coefficientNotApplicable?'—':row.kappa===null?'Undefined':formatIcrValue(row.kappa);
export interface ComparisonResult {title:string;description:string;rows:ComparisonRow[];text:string;warnings:string[];}
export const comparisonMethods:Record<ComparisonMethod,string>={presence:'Code presence and RK correction',characters:'Characters',sentences:'Sentences',paragraphs:'Paragraphs',segments:'Segment overlap',frequency:'Code frequency by document',domains:'Semantic domains',training:'Fixed-excerpt test and ratings'};
const emptyTable=():IcrContingency=>({bothYes:0,aOnly:0,bOnly:0,bothNo:0,n:0});
function add(table:IcrContingency,a:boolean,b:boolean,weight=1){table.n+=weight;table[a?(b?'bothYes':'aOnly'):(b?'bOnly':'bothNo')]+=weight;}
const agreement=(t:IcrContingency)=>t.n?100*(t.bothYes+t.bothNo)/t.n:null;
const fmt=(n:number|null)=>n===null?'undefined':formatIcrValue(n);
export function brennanPrediger(observed:number|null,categories:number):number|null {return observed===null||categories<2?null:(observed-1/categories)/(1-1/categories);}
export function pearson(pairs:Array<[number,number]>):number|null {
  if(pairs.length<2)return null;
  const mean=(index:0|1)=>pairs.reduce((sum,pair)=>sum+pair[index],0)/pairs.length,a=mean(0),b=mean(1);
  let xy=0,xx=0,yy=0;for(const [x,y] of pairs){xy+=(x-a)*(y-b);xx+=(x-a)**2;yy+=(y-b)**2;}
  return xx&&yy?Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))):null;
}
/** Coincidence alpha without expanding character intervals into millions of rows. */
export function weightedAlpha(items:WeightedRatings[],distance?:(a:string,b:string)=>{difference:number;product:number}):number|null {
  const totals=new Map<string,number>();let observedNum=0,observedDen=0;
  const delta=distance||((a:string,b:string)=>({difference:a===b?0:1,product:1}));
  for(const item of items){const values=item.ratings.filter((v):v is string=>v!==null);if(values.length<2||item.weight<=0)continue;const counts=new Map<string,number>();for(const value of values){counts.set(value,(counts.get(value)||0)+1);totals.set(value,(totals.get(value)||0)+item.weight);}
    for(const [a,na] of counts)for(const [b,nb] of counts){const mass=item.weight*na*(nb-(a===b?1:0))/(values.length-1),d=delta(a,b);observedNum+=mass*d.difference;observedDen+=mass*d.product;}
  }
  let expectedNum=0,expectedDen=0;
  for(const [a,na] of totals)for(const [b,nb] of totals){const mass=na*(nb-(a===b?1:0)),d=delta(a,b);expectedNum+=mass*d.difference;expectedDen+=mass*d.product;}
  if(!observedDen||!expectedNum||!expectedDen)return null;
  return 1-(observedNum/observedDen)/(expectedNum/expectedDen);
}
function fleiss(items:WeightedRatings[]):number|null {
  const usable=items.filter(item=>item.ratings.length>=2&&item.ratings.every(value=>value!==null));if(!usable.length)return null;
  const m=usable[0].ratings.length;if(usable.some(item=>item.ratings.length!==m))return null;
  let po=0,n=0;const totals=new Map<string,number>();
  for(const item of usable){const counts=new Map<string,number>();for(const v of item.ratings as string[]){counts.set(v,(counts.get(v)||0)+1);totals.set(v,(totals.get(v)||0)+item.weight);}po+=item.weight*[...counts.values()].reduce((sum,c)=>sum+c*(c-1),0)/(m*(m-1));n+=item.weight;}
  const pe=[...totals.values()].reduce((sum,count)=>sum+(count/(n*m))**2,0);return pe===1?null:(po/n-pe)/(1-pe);
}
export function defaultComparisonSettings(project:Project):IcrComparisonSettings{return {method:'characters',codeIds:project.codes.map(c=>c.id),overlap:90,domains:project.codes.filter(c=>!c.parentId).map(c=>({name:c.name,codeIds:project.codes.filter(child=>child.parentId===c.id).map(child=>child.id)})).filter(d=>d.codeIds.length),training:[]};}
export function computeComparison(project:Project,coderNames:string[],scope:IcrScope,settings:IcrComparisonSettings):ComparisonResult {
  const coders=Array.from(new Set(coderNames.map(normalizeCoderName))),selected=new Set(settings.codeIds),codes=project.codes.filter(c=>selected.has(c.id));
  const docs=project.docs.filter(d=>scope.docIds.includes(d.id));
  if(coders.length<2)throw Error('Select at least two attributed coders.');
  const warnings=['The comparison assumes every selected coder reviewed the selected units. Unreviewed material cannot be inferred from an absent code.'];
  if(settings.method==='training')return trainingComparison(settings.training,coders,warnings);
  if(scope.includeImages)warnings.push('These text and fixed-excerpt comparisons exclude image-region coding. Source-level ICR above can include images.');
  const segments=project.codedSegments.filter(s=>docs.some(d=>d.id===s.docId)&&coders.includes(normalizeCoderName(s.coder))&&selected.has(s.codeId));
  for(const s of segments){const doc=docs.find(d=>d.id===s.docId)!;if(!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end<=s.start||s.end>doc.content.length)throw Error('Some selected coding ranges are invalid for their source text. Repair them before comparison.');}
  const rows:ComparisonRow[]=[],pairs=coders.flatMap((a,i)=>coders.slice(i+1).map(b=>[a,b] as const));
  if(settings.method==='segments'||settings.method==='frequency'||settings.method==='presence'){
    if(!codes.length||!docs.length)throw Error('Select text documents and codes.');
    const tolerance=settings.overlap/100;if(tolerance<0||tolerance>1)throw Error('Overlap must be between 0 and 100%.');
    for(const [a,b] of pairs){let matches=0,total=0;
      for(const code of codes){let cm=0,cn=0;
        if(settings.method==='frequency'||settings.method==='presence')for(const doc of docs){const aCount=segments.filter(s=>s.docId===doc.id&&s.codeId===code.id&&normalizeCoderName(s.coder)===a).length,bCount=segments.filter(s=>s.docId===doc.id&&s.codeId===code.id&&normalizeCoderName(s.coder)===b).length;if(settings.jointAbsences===false&&!aCount&&!bCount)continue;cn++;if(settings.method==='presence'?(aCount>0)===(bCount>0):aCount===bCount)cm++;}
        else{const aSegments=segments.filter(s=>s.codeId===code.id&&normalizeCoderName(s.coder)===a),bSegments=segments.filter(s=>s.codeId===code.id&&normalizeCoderName(s.coder)===b);
          for(const [left,right] of [[aSegments,bSegments],[bSegments,aSegments]])for(const s of left){cn++;if(right.some(t=>s.docId===t.docId&&Math.max(0,Math.min(s.end,t.end)-Math.max(s.start,t.start))>0&&(Math.min(s.end,t.end)-Math.max(s.start,t.start))/(Math.max(s.end,t.end)-Math.min(s.start,t.start))>=tolerance))cm++;}
        }
        matches+=cm;total+=cn;rows.push({label:`${a} / ${b} — ${code.name}`,items:cn,agreement:cn?100*cm/cn:null,kappa:null,coefficientNotApplicable:true});
      }
      const po=total?matches/total:null,activeCodes=new Set(segments.filter(s=>[a,b].includes(normalizeCoderName(s.coder))).map(s=>s.codeId)).size;
      rows.unshift({label:`${a} / ${b} — total`,items:total,agreement:po===null?null:po*100,kappa:settings.method==='segments'?brennanPrediger(po,activeCodes):null,coefficientNotApplicable:settings.method!=='segments'});
      if(settings.method==='presence'&&settings.jointAbsences!==false){const chance=0.5**codes.length;rows[0].label+=' — RK κ (chance = 0.5^'+codes.length+')';rows[0].kappa=po===null?null:(po-chance)/(1-chance);rows[0].coefficientNotApplicable=false;}
      if(settings.method==='segments')rows.push({label:`${a} / ${b} — Brennan–Prediger binary correction (chance = 0.5)`,items:total,agreement:po===null?null:po*100,kappa:brennanPrediger(po,2)});
    }
    const description=settings.method==='segments'?`Each coder’s segment is checked against the other coder’s segments with the same code in the same document. A match requires intersection / outer span ≥ ${settings.overlap}%. Both directions are counted; a matching pair contributes two checks. Jointly uncoded text is excluded. Brennan–Prediger κ uses chance = 1 / number of active codes; the binary correction uses chance = 0.5.`:settings.method==='presence'?`Each document × direct-code item compares whether the code was applied at least once. Joint absences are ${settings.jointAbsences===false?'excluded; RK correction is not reported':'included; Rädiker–Kuckartz (RK) κ uses chance = 0.5 raised to the number of selected codes'}.`:`Each document × direct-code item agrees only when both coders applied the code the same number of times. Equal zero counts are ${settings.jointAbsences===false?'excluded':'included'}. No chance-corrected coefficient is reported for frequency equality.`;
    return finish(comparisonMethods[settings.method],description,rows,warnings,coders,docs.length,codes.length);
  }
  if(!docs.length||!codes.length)throw Error('Select text documents and codes.');
  const items:WeightedRatings[]=[],perDoc=new Map<string,WeightedRatings[]>(),perCode=new Map<string,WeightedRatings[]>();
  const domainItems=new Map<string,WeightedRatings[]>(),domainBinary=new Map<string,WeightedRatings[]>(),globalDomainItems:WeightedRatings[]=[],relevance:WeightedRatings[]=[];
  const domains=settings.domains.map(d=>({...d,codeIds:d.codeIds.filter(id=>selected.has(id))})).filter(d=>d.codeIds.length);
  if(settings.method==='domains'){
    if(!domains.length)throw Error('Define at least one semantic domain and its codes.');
    if(domains.some(domain=>!domain.name.trim()))throw Error('Give every semantic domain a name.');
    if(new Set(domains.map(d=>d.name)).size!==domains.length)throw Error('Semantic domain names must be distinct.');
    const assigned=domains.flatMap(d=>d.codeIds);if(new Set(assigned).size!==assigned.length)throw Error('A code must belong to only one semantic domain.');
  }
  for(const doc of docs){const ds=segments.filter(s=>s.docId===doc.id),units:Array<{start:number;end:number;weight:number}>=[];
    if(settings.method==='characters'||settings.method==='domains'){
      const boundaries=Array.from(new Set([0,doc.content.length,...ds.flatMap(s=>[s.start,s.end])])).sort((a,b)=>a-b);
      for(let i=1;i<boundaries.length;i++)if(boundaries[i]>boundaries[i-1])units.push({start:boundaries[i-1],end:boundaries[i],weight:boundaries[i]-boundaries[i-1]});
    }else if(settings.method==='sentences'){
      const Segmenter=(Intl as any).Segmenter;if(!Segmenter)throw Error('Sentence segmentation is unavailable in this runtime.');
      for(const part of new Segmenter(undefined,{granularity:'sentence'}).segment(doc.content))if(part.segment.trim())units.push({start:part.index,end:part.index+part.segment.length,weight:1});
    }else{for(const match of doc.content.matchAll(/[^\r\n]+(?:\r?\n|$)/g))if(match[0].trim())units.push({start:match.index!,end:match.index!+match[0].length,weight:1});}
    const docItems:WeightedRatings[]=[];
    for(const unit of units){const applied=coders.map(coder=>new Set(ds.filter(s=>normalizeCoderName(s.coder)===coder&&s.start<unit.end&&s.end>unit.start).map(s=>s.codeId)));
      if(settings.method==='domains'){
        relevance.push({ratings:applied.map(set=>domains.some(d=>d.codeIds.some(id=>set.has(id)))?'present':'absent'),weight:unit.weight});
        const recognized=applied.map(set=>domains.filter(d=>d.codeIds.some(id=>set.has(id))).map(d=>d.name).sort());
        globalDomainItems.push({ratings:recognized.map(set=>set.length?JSON.stringify(set):null),weight:unit.weight});
        for(const code of codes){const list=perCode.get(code.id)||[];list.push({ratings:applied.map(set=>set.has(code.id)?'present':'absent'),weight:unit.weight});perCode.set(code.id,list);}
        for(const domain of domains){const values=applied.map(set=>domain.codeIds.filter(id=>set.has(id)));if(values.some(ids=>ids.length>1))throw Error(`Semantic domain “${domain.name}” has overlapping codes applied by the same coder in ${doc.name}. Its codes must be mutually exclusive. Resolve the conflict before calculating domain alpha.`);const list=domainItems.get(domain.name)||[];list.push({ratings:values.map(ids=>ids[0]||null),weight:unit.weight});domainItems.set(domain.name,list);const binary=domainBinary.get(domain.name)||[];binary.push({ratings:values.map(ids=>ids.length?'present':'absent'),weight:unit.weight});domainBinary.set(domain.name,binary);}
      }else for(const code of codes){const item={ratings:applied.map(set=>set.has(code.id)?'present':'absent'),weight:unit.weight};items.push(item);docItems.push(item);const list=perCode.get(code.id)||[];list.push(item);perCode.set(code.id,list);}
    }perDoc.set(doc.id,docItems);
  }
  if(settings.method==='domains'){
    const binaryAlpha=weightedAlpha(relevance);rows.push({label:'Global alpha binary — relevant vs uncoded text',items:relevance.reduce((sum,u)=>sum+u.weight,0),agreement:null,kappa:binaryAlpha});
    for(const domain of domains){const units=domainItems.get(domain.name)||[];rows.push({label:`cu-alpha — ${domain.name}`,items:units.filter(u=>u.ratings.filter(v=>v!==null).length>=2).reduce((sum,u)=>sum+u.weight,0),agreement:null,kappa:weightedAlpha(units)});}
    for(const [name,units] of domainBinary)rows.push({label:'Domain alpha binary — '+name,items:units.reduce((sum,u)=>sum+u.weight,0),agreement:null,kappa:weightedAlpha(units)});
    for(const code of codes){const units=perCode.get(code.id)||[];rows.push({label:'Code alpha binary — '+code.name,items:units.reduce((sum,u)=>sum+u.weight,0),agreement:null,kappa:weightedAlpha(units)});}
    const distance=(a:string,b:string)=>{const x=JSON.parse(a) as string[],y=JSON.parse(b) as string[],intersection=x.filter(v=>y.includes(v)).length;return {difference:x.length*y.length-intersection**2,product:x.length*y.length};};
    rows.push({label:'Cu-style global semantic-domain set alpha',items:globalDomainItems.filter(u=>u.ratings.filter(v=>v!==null).length>=2).reduce((sum,u)=>sum+u.weight,0),agreement:null,kappa:weightedAlpha(globalDomainItems,distance)});
    warnings.push('Domain cu-alpha uses only positions where at least two coders assigned a code in that domain; absence is missing for that calculation. Global binary alpha separately assesses relevant vs uncoded text. The global set coefficient uses the domain-set distance |C||K| − |C∩K|² and finite-sample coincidence correction; it has not been validated for equivalence with the published global Cu-alpha method.');
    return finish('Semantic-domain alpha','Character-length weighted comparisons on selected text. Domain codes must be mutually exclusive within each coder’s overlapping ranges. Images are excluded.',rows,warnings,coders,docs.length,codes.length);
  }
  for(const [a,b] of pairs){const ai=coders.indexOf(a),bi=coders.indexOf(b),table=emptyTable();
    const summarize=(list:WeightedRatings[])=>{const t=emptyTable();for(const item of list)add(t,item.ratings[ai]==='present',item.ratings[bi]==='present',item.weight);return t;};
    Object.assign(table,summarize(items));rows.push({label:`${a} / ${b} — pooled`,items:table.n,agreement:agreement(table),kappa:cohenKappa(table),holsti:holstiIndex(table)});
    const fileRows=[...perDoc].map(([id,list])=>{const t=summarize(list);return {label:`${a} / ${b} — ${docs.find(d=>d.id===id)!.name}`,items:t.n,agreement:agreement(t),kappa:cohenKappa(t)};});rows.push(...fileRows);
    const defined=fileRows.filter(row=>row.kappa!==null);rows.push({label:`${a} / ${b} — equal-document mean κ (${fileRows.length-defined.length} undefined excluded)`,items:fileRows.length,agreement:null,kappa:defined.length?defined.reduce((sum,row)=>sum+row.kappa!,0)/defined.length:null});
    for(const code of codes){const t=summarize(perCode.get(code.id)||[]);rows.push({label:`${a} / ${b} — code ${code.name}`,items:t.n,agreement:agreement(t),kappa:cohenKappa(t),holsti:holstiIndex(t)});}
  }
  const count=items.reduce((sum,u)=>sum+u.weight,0),full=items.filter(u=>u.ratings.every(value=>value===u.ratings[0])).reduce((sum,u)=>sum+u.weight,0);
  rows.push({label:'All coders — nominal alpha binary',items:count,agreement:count?100*full/count:null,kappa:weightedAlpha(items)});
  if(coders.length>=3)rows.push({label:'All coders — Fleiss’ κ',items:count,agreement:count?100*full/count:null,kappa:fleiss(items)});
  for(const code of codes){const list=perCode.get(code.id)||[];rows.push({label:'Code alpha binary — '+code.name,items:list.reduce((sum,u)=>sum+u.weight,0),agreement:null,kappa:weightedAlpha(list)});}
  const description=settings.method==='characters'?'Each UTF-16 character position × direct code is a present/absent item; source offsets use UTF-16. Intervals with identical coding are length-weighted without expanding characters.':settings.method==='sentences'?'Each sentence × direct code is a present/absent item. Any coding overlap marks the whole sentence present. Sentences use the runtime’s Unicode sentence segmenter; whitespace-only units are excluded.':'Each non-empty newline-delimited paragraph × direct code is a present/absent item. Any coding overlap marks the whole paragraph present.';
  warnings.push('Pooled κ weights comparison items equally; equal-document mean κ gives each defined document coefficient equal weight. Sentence/paragraph parsing and aggregation may differ from another application.');
  return finish(comparisonMethods[settings.method],description,rows,warnings,coders,docs.length,codes.length);
}
function trainingComparison(data:IcrTrainingRow[],coders:string[],warnings:string[]):ComparisonResult {
  const scoped=data.filter(row=>coders.includes(normalizeCoderName(row.coder)));if(!scoped.length)throw Error('Import fixed-excerpt test rows for the selected coders first.');
  const keys=new Set<string>();for(const row of scoped){const key=JSON.stringify([row.unit,normalizeCoderName(row.coder),row.code]);if(keys.has(key))throw Error('Duplicate Unit/Coder/Code rows in the fixed-excerpt test.');keys.add(key);if(row.rating!==undefined&&!Number.isFinite(row.rating))throw Error('Ratings must be finite numbers.');}
  const codes=Array.from(new Set(scoped.map(row=>row.code))),units=Array.from(new Set(scoped.map(row=>row.unit))),rows:ComparisonRow[]=[];
  for(let a=0;a<coders.length;a++)for(let b=a+1;b<coders.length;b++){
    const overall=emptyTable();for(const code of codes){const table=emptyTable(),ratings:Array<[number,number]>=[];
      for(const unit of units){const left=scoped.find(row=>row.unit===unit&&row.code===code&&normalizeCoderName(row.coder)===coders[a]),right=scoped.find(row=>row.unit===unit&&row.code===code&&normalizeCoderName(row.coder)===coders[b]);if(!left||!right)continue;add(table,left.present,right.present);add(overall,left.present,right.present);if(left.present&&right.present&&left.rating!==undefined&&right.rating!==undefined)ratings.push([left.rating,right.rating]);}
      rows.push({label:`${coders[a]} / ${coders[b]} — ${code}`,items:table.n,agreement:agreement(table),kappa:cohenKappa(table),holsti:holstiIndex(table)});
      rows.push({label:`${coders[a]} / ${coders[b]} — Pearson r for ${code} ratings`,items:ratings.length,agreement:null,kappa:pearson(ratings)});
    }rows.unshift({label:`${coders[a]} / ${coders[b]} — pooled fixed-excerpt κ`,items:overall.n,agreement:agreement(overall),kappa:cohenKappa(overall),holsti:holstiIndex(overall)});
  }
  warnings.push('Missing Unit/Coder/Code rows are missing observations, not negative decisions. Ratings are paired only when both coders marked the code present and supplied numeric ratings. Pearson r measures correlation, not absolute agreement.');
  return finish('Fixed-excerpt test and ratings','Fixed test units are explicitly supplied rather than inferred from overlapping quotes. Cohen’s κ uses binary code-application decisions. Pearson r is calculated separately for each code’s paired ratings.',rows,warnings,coders,units.length,codes.length);
}
function finish(title:string,description:string,rows:ComparisonRow[],warnings:string[],coders:string[],sources:number,codes:number):ComparisonResult {
  const range=(values:Array<number|null|undefined>,digits=3)=>{const defined=values.filter((v):v is number=>v!==null&&v!==undefined&&Number.isFinite(v));if(!defined.length)return 'undefined';const low=Math.min(...defined),high=Math.max(...defined);return low===high?low.toFixed(digits):low.toFixed(digits)+'–'+high.toFixed(digits);};
  const totals=rows.filter(row=>/pooled|— total/.test(row.label));
  let text=`Intercoder agreement was assessed in eQc using ${title.toLowerCase()} for ${coders.length} coders, ${sources} ${title.startsWith('Fixed')?'fixed units':'text documents'} and ${codes} codes. ${description} `;
  if(totals.length){text+=`Across ${totals.length} coder pairs, ${range(totals.map(row=>row.items),0)} items per pair were compared; observed agreement was ${range(totals.map(row=>row.agreement),1)}%. `;if(!title.includes('frequency')&&!(title.startsWith('Code presence')&&totals.every(row=>row.kappa===null)))text+=`${title.includes('Segment')?'Brennan–Prediger':title.startsWith('Code presence')?'RK':'Cohen’s'} κ was ${range(totals.map(row=>row.kappa))} (${totals.filter(row=>row.kappa===null).length} undefined pair coefficients). `;if(totals.some(row=>row.holsti!==undefined))text+=`Holsti was ${range(totals.map(row=>row.holsti))}. `;}
  const binary=rows.filter(row=>row.label.includes('binary correction'));if(binary.length)text+=`Brennan–Prediger κ with binary chance correction was ${range(binary.map(row=>row.kappa))}. `;
  const equal=rows.filter(row=>row.label.includes('mean κ'));if(equal.length)text+=`Equal-document mean κ was ${range(equal.map(row=>row.kappa))}, excluding undefined document coefficients. `;
  const correlations=rows.filter(row=>row.label.includes('Pearson'));if(correlations.length)text+=`Per-code Pearson correlations for paired positive ratings were ${range(correlations.map(row=>row.kappa))}; ${correlations.filter(row=>row.kappa===null).length} correlations were undefined. Pearson correlation does not measure absolute agreement. `;
  for(const row of rows.filter(row=>/All coders|Global alpha binary|^cu-alpha/.test(row.label)))text+=`${row.label}: n = ${row.items}, ${/alpha/.test(row.label)?'α':'κ'} = ${fmt(row.kappa)}${row.agreement===null?'':`, full agreement = ${row.agreement.toFixed(1)}%`}. `;
  if(title.includes('Semantic'))text+='The exploratory global Cu-style domain-set coefficient is omitted from this reporting paragraph because equivalence with the published global Cu-alpha method has not been validated. ';
  text+='Undefined coefficients are excluded from ranges. Coding independence and any disagreement-resolution procedure must be described separately.';
  return {title,description,rows,text,warnings};
}
