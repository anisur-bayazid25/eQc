import Papa from 'papaparse';
import {Project, ResearchCase, uid} from '../domain';

const reserved = new Set(['Case ID','Case','Kind','Document','Links','Notes','Attribute types']);
export function validateCaseAttributes(c:Pick<ResearchCase,'attributes'|'attributeTypes'>) {
  for(const [key,type] of Object.entries(c.attributeTypes||{})){
    const value=c.attributes[key];if(value===undefined||value==='')continue;
    const dateValid=/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
    if(type==='number'&&!Number.isFinite(Number(value))||type==='boolean'&&!['true','false'].includes(value.toLowerCase())||type==='date'&&!dateValid)throw Error(`${key} is not a valid ${type}.`);
  }
}
export function caseTableRows(project: Project): Record<string,string>[] {
  const keys = Array.from(new Set((project.cases||[]).flatMap(c=>Object.keys(c.attributes)))).sort();
  const sources = [...project.docs,...(project.images||[])];
  return (project.cases||[]).map(c=>Object.fromEntries([
    ['Case ID',c.id],['Case',c.name],['Kind',c.kind],['Notes',c.notes||''],
    ['Document',sources.filter(s=>c.links.some(l=>l.docId===s.id)).map(s=>s.name).join('; ')],
    ['Links',JSON.stringify(c.links.map(l=>({...l,sourceName:sources.find(s=>s.id===l.docId)?.name||''})))],
    ['Attribute types',JSON.stringify(c.attributeTypes||{})],
    ...keys.map(key=>['Attribute: '+key,c.attributes[key]??'']),
  ]));
}
export function caseTableCsv(project: Project): string {
  const rows=caseTableRows(project);
  return rows.length ? Papa.unparse(rows) : 'Case ID,Case,Kind,Notes,Document,Links,Attribute types';
}
export interface CaseImportPlan {cases:ResearchCase[];added:number;updated:number;unchanged:number;warnings:string[];}
export function previewCaseImport(project: Project, rows: Record<string,unknown>[], mode:'update'|'add'='update'):CaseImportPlan {
  const cases=[...(project.cases||[])], warnings:string[]=[]; let added=0,updated=0,unchanged=0;
  const seen=new Set<string>(), sources=[...project.docs,...(project.images||[])];
  if(!rows.length||!Object.prototype.hasOwnProperty.call(rows[0],'Case'))throw Error('The table needs a Case column. Use Export cases Excel for a matching template.');
  for(const [index,raw] of rows.entries()) {
    const row=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,String(v??'')]));
    const name=row.Case?.trim();if(!name)throw Error(`Row ${index+2}: case name is missing.`);
    const id=row['Case ID']?.trim(), key=id||name;
    if(seen.has(key))throw Error(`Row ${index+2}: duplicate case ${name}.`);seen.add(key);
    const byId=id?cases.find(c=>c.id===id):undefined, byName=cases.filter(c=>c.name===name);
    if(!byId&&byName.length>1&&mode==='update')throw Error(`Case ${name} is ambiguous. Use stable Case ID values.`);
    const existing=mode==='update'?(byId||byName[0]):undefined;
    const attributes:Record<string,string>=Object.create(null);
    for(const [key,value] of Object.entries(row))if(!reserved.has(key))attributes[key.startsWith('Attribute: ')?key.slice(11):key]=value;
    let types:ResearchCase['attributeTypes']={};
    if(row['Attribute types']?.trim()) {
      types=JSON.parse(row['Attribute types']);
      if(!types||typeof types!=='object'||Array.isArray(types)||Object.values(types).some(t=>!['text','number','boolean','date'].includes(t)))throw Error(`Row ${index+2}: invalid attribute types.`);
    }
    for(const [key,type] of Object.entries(types)) {
      const value=attributes[key];if(value===undefined||value==='')continue;
      if(type==='number'&&!Number.isFinite(Number(value))||type==='boolean'&&!['true','false'].includes(value.toLowerCase())||type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))))throw Error(`Row ${index+2}: ${key} is not a valid ${type}.`);
    }
    validateCaseAttributes({attributes,attributeTypes:types});
    const links:ResearchCase['links']=[];
    const resolve=(sourceId:string,sourceName:string)=>{
      const exact=sources.find(s=>s.id===sourceId);if(exact)return exact;
      const matches=sources.filter(s=>s.name===sourceName);
      if(matches.length===1)return matches[0];
      warnings.push(`${name}: ${matches.length?'ambiguous':'unmatched'} source “${sourceName||sourceId}”; link omitted.`);return undefined;
    };
    if(row.Links?.trim()) {
      const incoming=JSON.parse(row.Links);if(!Array.isArray(incoming))throw Error(`Row ${index+2}: Links must be an array.`);
      for(const link of incoming) {
        if(!link||typeof link.docId!=='string')throw Error(`Row ${index+2}: invalid source link.`);
        const source=resolve(link.docId,String(link.sourceName||''));if(!source)continue;
        if(link.start!==undefined||link.end!==undefined) {
          const doc=project.docs.find(d=>d.id===source.id);
          if(!doc||!Number.isInteger(link.start)||!Number.isInteger(link.end)||link.start<0||link.end<=link.start||link.end>doc.content.length)throw Error(`Row ${index+2}: invalid passage link in ${source.name}.`);
          links.push({docId:source.id,start:link.start,end:link.end});
        }else links.push({docId:source.id});
      }
    }else if(row.Document?.trim())for(const sourceName of row.Document.split(';').map(s=>s.trim()).filter(Boolean)){const source=resolve('',sourceName);if(source)links.push({docId:source.id});}
    const kind=row.Kind?.trim()||existing?.kind||'person';
    if(!['person','organisation','place','other'].includes(kind))throw Error(`Row ${index+2}: invalid case type.`);
    const next:ResearchCase={id:existing?.id||(mode==='update'&&id&&!cases.some(c=>c.id===id)?id:uid('case')),name,kind:kind as ResearchCase['kind'],
      attributes:{...(existing?.attributes||{}),...attributes},attributeTypes:{...(existing?.attributeTypes||{}),...types},
      links:row.Links!==undefined||row.Document!==undefined?links:existing?.links||[],notes:row.Notes??existing?.notes};
    if(existing){const at=cases.indexOf(existing);if(JSON.stringify(existing)===JSON.stringify(next))unchanged++;else updated++;cases[at]=next;}
    else{cases.push(next);added++;}
  }
  return {cases,added,updated,unchanged,warnings};
}
