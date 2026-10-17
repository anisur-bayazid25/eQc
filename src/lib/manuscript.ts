import {Project,childCodes} from '../domain';
import {quoteAttribution} from './caseAttributes';

export interface ManuscriptNode {
  name:string;depth:number;summary?:string;quotes?:string[];
  attributedQuotes?:Array<{text:string;attribution:string}>;
  imageQuotes?:Array<{base64:string;width:number;height:number;caption:string}>;
}
export interface ManuscriptOptions {framework:boolean;cooccurrence:boolean;projectMemos:boolean;icrText?:string;}
export async function buildManuscriptOutline(project:Project,options:ManuscriptOptions,crop?:(image:string,region:any)=>Promise<{base64:string;width:number;height:number}>) {
  const outline:ManuscriptNode[]=[];
  if(options.icrText)outline.push({name:'Methodology',depth:0,summary:options.icrText});
  const results:ManuscriptNode[]=[];
  const attached=new Set<string>();
  async function walk(parentId:string|null,depth:number){
    for(const code of childCodes(project.codes,parentId)){
      const linked=(project.memos||[]).filter(m=>m.kind==='analytic'&&m.codeIds.includes(code.id)&&!attached.has(m.id));
      linked.forEach(m=>attached.add(m.id));
      const summary=[code.summary.trim(),...linked.map(m=>m.title+'\n'+m.text)].filter(Boolean).join('\n\n');
      const starred=project.codedSegments.filter(s=>s.codeId===code.id&&s.starred);
      const seen=new Set<string>(),attributedQuotes=starred.filter(s=>{const key=JSON.stringify([s.docId,s.start,s.end,s.text]);if(seen.has(key))return false;seen.add(key);return true;}).map(s=>({text:s.text,attribution:quoteAttribution(project,s.docId,s)}));
      const imageQuotes:NonNullable<ManuscriptNode['imageQuotes']>=[];
      const imageSeen=new Set<string>();
      for(const region of (project.codedRegions||[]).filter(r=>r.codeId===code.id&&r.starred)){
        const key=JSON.stringify([region.imageId,region.x,region.y,region.width,region.height]);if(imageSeen.has(key))continue;imageSeen.add(key);
        const image=project.images?.find(i=>i.id===region.imageId);if(image&&crop)imageQuotes.push({...await crop(image.dataUrl,region),caption:quoteAttribution(project,image.id)});
      }
      const index=results.length;
      results.push({name:code.name,depth:depth+1,summary:summary||undefined,attributedQuotes:attributedQuotes.length?attributedQuotes:undefined,imageQuotes:imageQuotes.length?imageQuotes:undefined});
      await walk(code.id,depth+1);
      // Keep headings needed to preserve the hierarchy of populated descendants.
      if(!summary&&!attributedQuotes.length&&!imageQuotes.length&&results.length===index+1)results.splice(index,1);
    }
  }
  await walk(null,0);
  const codeName=(id:string)=>project.codes.find(c=>c.id===id)?.name||'Unavailable code';
  if(options.framework){const cells=(project.frameworkCells||[]).filter(f=>f.text.trim());if(cells.length){results.push({name:'Framework synthesis memos',depth:1});for(const cell of cells)results.push({name:codeName(cell.codeId),depth:2,summary:cell.text});}}
  if(options.cooccurrence){const notes=(project.relationNotes||[]).filter(n=>n.note.trim());if(notes.length){results.push({name:'Code co-occurrence memos',depth:1});for(const note of notes)results.push({name:codeName(note.codeAId)+' × '+codeName(note.codeBId),depth:2,summary:note.note});}}
  if(options.projectMemos)for(const memo of (project.memos||[]).filter(m=>m.kind==='analytic'&&!attached.has(m.id)&&m.text.trim()))results.push({name:memo.title,depth:1,summary:memo.text});
  if(results.length)outline.push({name:'Results',depth:0},...results);
  return outline;
}
