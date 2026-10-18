import {Project,ResearchCase,uid} from '../domain';
import {utf16ToQdaRange,qdaToUtf16Range} from './qdpxOffsets';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function caseSelections(project:Project,uuid:()=>string) {
  const bySource=new Map<string,string>(),byCase=new Map<string,string[]>();
  for(const c of project.cases||[])for(const link of c.links)if(link.start!==undefined){
    const doc=project.docs.find(d=>d.id===link.docId);
    if(!doc||!Number.isInteger(link.start)||!Number.isInteger(link.end)||link.start<0||link.end!<=link.start||link.end!>doc.content.length)throw Error('Invalid case passage link: '+c.name);
    const id=uuid(),range=utf16ToQdaRange(doc.content,link.start,link.end!);
    bySource.set(doc.id,(bySource.get(doc.id)||'')+`<PlainTextSelection guid="${id}" name="${esc(c.name)}" startPosition="${range.start}" endPosition="${range.end}"/>`);
    byCase.set(c.id,[...(byCase.get(c.id)||[]),id]);
  }
  return {bySource,byCase};
}
export function structuredResearchXml(project:Project,sourceGuids:Map<string,string>,codeGuids:Map<string,string>,selections:ReturnType<typeof caseSelections>,uuid:()=>string) {
  const vars=new Map<string,{guid:string;type:string}>();
  for(const c of project.cases||[])for(const [key,value] of Object.entries(c.attributes)){
    let type=c.attributeTypes?.[key]||'text';
    if(type==='number'&&(!value.trim()||!Number.isFinite(Number(value)))||type==='boolean'&&!['true','false'].includes(value.toLowerCase())||type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))type='text';
    const existing=vars.get(key);vars.set(key,{guid:existing?.guid||uuid(),type:existing&&existing.type!==type?'text':type});
  }
  const variableXml=Array.from(vars,([name,v])=>`<Variable guid="${v.guid}" name="${esc(name)}" typeOfVariable="${({text:'Text',number:'Float',boolean:'Boolean',date:'Date'} as Record<string,string>)[v.type]}"/>`).join('');
  const cases=(project.cases||[]).map(c=>{
    const values=Object.entries(c.attributes).map(([key,value])=>{const v=vars.get(key)!,type=({text:'Text',number:'Float',boolean:'Boolean',date:'Date'} as Record<string,string>)[v.type];return `<VariableValue><VariableRef targetGUID="${v.guid}"/><${type}Value>${esc(v.type==='boolean'?value.toLowerCase():v.type==='number'?Number(value).toLocaleString('en-US',{useGrouping:false,maximumSignificantDigits:21}):value)}</${type}Value></VariableValue>`;}).join('');
    const refs=c.links.filter(l=>l.start===undefined).map(l=>{const guid=sourceGuids.get(l.docId);if(!guid)throw Error('Missing case source: '+c.name);return `<SourceRef targetGUID="${guid}"/>`;}).join('');
    return `<Case guid="${uuid()}" name="${esc(c.name)}">${c.notes?`<Description>${esc(c.notes)}</Description>`:''}${values}${refs}${(selections.byCase.get(c.id)||[]).map(g=>`<SelectionRef targetGUID="${g}"/>`).join('')}</Case>`;
  }).join('');
  const sets=(project.groups||[]).map(g=>`<Set guid="${uuid()}" name="${esc(g.name)}">${g.memberIds.map(id=>{const guid=(g.kind==='codes'?codeGuids:sourceGuids).get(id);if(!guid)throw Error('Missing group member: '+g.name);return `<${g.kind==='codes'?'MemberCode':'MemberSource'} targetGUID="${guid}"/>`;}).join('')}</Set>`).join('');
  return {variables:variableXml?`<Variables>${variableXml}</Variables>`:'',cases:cases?`<Cases>${cases}</Cases>`:'',sets:sets?`<Sets>${sets}</Sets>`:''};
}
const direct=(node:Element,name:string)=>Array.from(node.childNodes).filter((n):n is Element=>n.nodeType===1&&(n as Element).localName===name);
export function importStructuredResearch(project:Project,document:Document,guids:Map<string,string>,warnings:string[]) {
  const variables=new Map(Array.from(document.getElementsByTagNameNS('*','Variable')).map(v=>[v.getAttribute('guid'),{name:v.getAttribute('name')||'Attribute',type:v.getAttribute('typeOfVariable')||'Text'}]));
  // Some exporters attach variables to sources rather than Cases. Represent
  // these as explicitly named source cases so filters retain the values.
  for(const tag of ['TextSource','PDFSource','PictureSource'])for(const node of Array.from(document.getElementsByTagNameNS('*',tag))){
    const values=direct(node,'VariableValue'),sourceId=guids.get(node.getAttribute('guid')||'');if(!values.length||!sourceId)continue;
    const attributes:Record<string,string>={},attributeTypes:NonNullable<ResearchCase['attributeTypes']>={};
    for(const value of values){const ref=direct(value,'VariableRef')[0]?.getAttribute('targetGUID'),variable=variables.get(ref||'');if(!variable){warnings.push('Source variable reference could not be resolved.');continue;}const child=Array.from(value.childNodes).find(n=>n.nodeType===1&&(n as Element).localName!=='VariableRef');attributes[variable.name]=child?.textContent||'';attributeTypes[variable.name]=['Integer','Float'].includes(variable.type)?'number':variable.type==='Boolean'?'boolean':variable.type==='Date'?'date':'text';}
    for(const [key,type] of Object.entries(attributeTypes))if(type==='boolean')attributes[key]=['1','true'].includes(attributes[key].toLowerCase())?'true':'false';
    project.cases||=[];project.cases.push({id:uid('case'),name:'Source attributes — '+(node.getAttribute('name')||sourceId),kind:'other',attributes,attributeTypes,links:[{docId:sourceId}]});
    warnings.push('Source attributes retained as a linked source case: '+(node.getAttribute('name')||sourceId));
  }
  for(const node of Array.from(document.getElementsByTagNameNS('*','Case'))){
    const c:ResearchCase={id:uid('case'),name:node.getAttribute('name')||'Imported case',kind:'person',attributes:{},attributeTypes:{},links:[],notes:direct(node,'Description')[0]?.textContent||undefined};
    for(const value of direct(node,'VariableValue')){const ref=direct(value,'VariableRef')[0]?.getAttribute('targetGUID'),v=variables.get(ref||'');if(!v){warnings.push(c.name+': unknown variable reference.');continue;}const val=Array.from(value.childNodes).find((n)=>n.nodeType===1&&(n as Element).localName!=='VariableRef');c.attributes[v.name]=val?.textContent||'';c.attributeTypes![v.name]=(['Float','Integer'].includes(v.type)?'number':v.type==='Boolean'?'boolean':v.type==='Date'?'date':'text');}
    for(const ref of direct(node,'SourceRef')){const id=guids.get(ref.getAttribute('targetGUID')||'');if(id&&[...project.docs,...(project.images||[])].some(s=>s.id===id))c.links.push({docId:id});else warnings.push(c.name+': unresolved source reference.');}
    for(const ref of direct(node,'SelectionRef')){
      const target=ref.getAttribute('targetGUID'),sel=Array.from(document.getElementsByTagNameNS('*','PlainTextSelection')).find(s=>s.getAttribute('guid')===target);
      const parent=sel?.parentNode as Element|undefined,docId=parent?guids.get(parent.getAttribute('guid')||''):undefined,doc=project.docs.find(d=>d.id===docId);
      const range=sel&&doc?qdaToUtf16Range(doc.content,Number(sel.getAttribute('startPosition')),Number(sel.getAttribute('endPosition'))):null;
      if(doc&&range)c.links.push({docId:doc.id,...range});else warnings.push(c.name+': unsupported or unresolved selection reference.');
    }
    for(const ref of direct(node,'CodeRef')){const id=guids.get(ref.getAttribute('targetGUID')||'');if(id){for(const s of project.codedSegments.filter(s=>s.codeId===id))c.links.push({docId:s.docId,start:s.start,end:s.end});for(const r of project.codedRegions||[])if(r.codeId===id)c.links.push({docId:r.imageId});warnings.push(c.name+': membership derived from its referenced case code; image membership is source-level.');}}
    for(const [key,type] of Object.entries(c.attributeTypes||{}))if(type==='boolean')c.attributes[key]=['1','true'].includes(c.attributes[key].toLowerCase())?'true':'false';
    project.cases||=[];project.cases.push(c);
  }
  for(const set of Array.from(document.getElementsByTagNameNS('*','Set'))){
    for(const [tag,kind] of [['MemberCode','codes'],['MemberSource','documents']] as const){const refs=direct(set,tag);if(!refs.length)continue;const members=refs.flatMap(r=>{const id=guids.get(r.getAttribute('targetGUID')||'');if(!id)warnings.push((set.getAttribute('name')||'Set')+': unresolved member.');return id?[id]:[];});project.groups||=[];project.groups.push({id:uid('group'),name:(set.getAttribute('name')||'Imported set')+(direct(set,tag==='MemberCode'?'MemberSource':'MemberCode').length?' — '+kind:''),kind,memberIds:members});}
    if(direct(set,'MemberNote').length)warnings.push((set.getAttribute('name')||'Set')+': note membership is not a source/code group.');
  }
  for(const tag of ['Graphs','AudioSource','VideoSource'])if(document.getElementsByTagNameNS('*',tag).length)warnings.push(tag+' objects require inspection; their editable native behavior is not imported.');
}
