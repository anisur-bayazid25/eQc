import {Project} from '../domain';
import {buildDemographicTable,DemographicTableDraft,demographicCellText} from './demographicTable';
export interface DemographicOutputCell {text:string;columnSpan?:number;rowSpan?:number;kind?:'heading'|'section'|'variable'|'number';}
export interface DemographicOutputRow {cells:DemographicOutputCell[];kind?:'header'|'section'|'total';}
export interface DemographicOutput {title:string;subtitle:string;notes:string[];style:DemographicTableDraft['style'];font:DemographicTableDraft['font'];fontSize:number;columnCount:number;rows:DemographicOutputRow[];}
export function demographicOutput(project:Project,draft:DemographicTableDraft):DemographicOutput {
  const data=buildDemographicTable(project,draft),rows:DemographicOutputRow[]=[],numeric=draft.fields.some(f=>f.mode==='numeric');
  if(draft.preset==='profiles'){
    rows.push({kind:'header',cells:['Case ID','Case',...draft.fields.map(f=>f.label)].map(text=>({text,kind:'heading'}))});
    for(const c of data.cases)rows.push({cells:[c.id,c.name,...draft.fields.map(f=>c.attributes[f.key]||'Not recorded')].map(text=>({text}))});
    return {title:draft.title,subtitle:draft.subtitle,notes:[`${data.cases.length} distinct cases.`,draft.note].filter(Boolean),style:draft.style,font:draft.font,fontSize:draft.fontSize,columnCount:2+draft.fields.length,rows};
  }
  const variable=draft.preset==='variables',metrics=draft.format==='separate'?2:1,leading=variable?2:1,columnCount=leading+data.groups.length*metrics;
  const labels=draft.format==='separate'?[draft.labels.count,numeric?draft.labels.percent+' / statistic':draft.labels.percent]:[draft.format==='count'?draft.labels.count:draft.format==='percent'?draft.labels.percent:numeric?'n (%) / statistic':'n (%)'];
  const leadingHeaders=variable?[draft.labels.variable,draft.labels.category]:[draft.labels.variable];
  if(draft.preset==='comparison'){
    rows.push({kind:'header',cells:[...leadingHeaders.map(text=>({text,kind:'heading' as const,rowSpan:metrics===2?2:1})),...data.groups.map(g=>({text:`${g.label} (N=${g.cases.length})`,kind:'heading' as const,columnSpan:metrics}))]});
    if(metrics===2)rows.push({kind:'header',cells:data.groups.flatMap(()=>labels.map(text=>({text,kind:'heading' as const})))});
  }else rows.push({kind:'header',cells:[...leadingHeaders,...labels].map(text=>({text,kind:'heading'}))});
  for(const section of data.sections){
    if(!variable)rows.push({kind:'section',cells:[{text:section.label,columnSpan:columnCount,kind:'section'}]});
    section.rows.forEach((row,index)=>{
      const cells:DemographicOutputCell[]=[];
      if(variable&&index===0)cells.push({text:section.label,rowSpan:section.rows.length,kind:'variable'});
      cells.push({text:row.label});
      for(const cell of row.cells){
        if(cell.text&&metrics===2)cells.push({text:`${cell.text}; n=${cell.n}`,columnSpan:2,kind:'number'});
        else cells.push(...demographicCellText(cell,draft.format,draft.decimals).map(text=>({text,kind:'number' as const})));
      }
      rows.push({cells});
    });
  }
  if(draft.showTotal)rows.push({kind:'total',cells:[{text:draft.labels.total,columnSpan:leading},...data.groups.flatMap(g=>draft.format==='separate'?[{text:String(g.cases.length),kind:'number' as const},{text:g.cases.length?(100).toFixed(draft.decimals):'—',kind:'number' as const}]:[{text:draft.format==='percent'?(g.cases.length?'100%':'—'):draft.format==='count'?String(g.cases.length):`${g.cases.length} (${g.cases.length?'100%':'—'})`,kind:'number' as const}])]});
  return {title:draft.title,subtitle:draft.subtitle,notes:[`${data.cases.length} distinct cases in the selected sources.`,...data.notes],style:draft.style,font:draft.font,fontSize:draft.fontSize,columnCount,rows};
}
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function demographicHtml(output:DemographicOutput) {
  const style=`body{font-family:${output.font==='serif'?'Georgia,serif':'Arial,sans-serif'};font-size:${output.fontSize}pt;color:#222;background:#fff;padding:24px}table{border-collapse:collapse;width:100%;border-top:1.5px solid #333;border-bottom:1.5px solid #333}th,td{padding:6px 10px;text-align:left;vertical-align:top;border:${output.style==='grid'?'1px solid #aaa':'none'}}thead th{border-bottom:1px solid #444}.number{text-align:right;white-space:nowrap}.section{font-weight:bold;border-top:1px solid #aaa;background:${output.style==='banded'?'#dce8f2':'transparent'}}.total{font-weight:bold;border-top:1px solid #333}.notes{font-size:9pt;line-height:1.4}h2{font-size:13pt;margin-bottom:8px}`;
  const headers=output.rows.filter(r=>r.kind==='header'),body=output.rows.filter(r=>r.kind!=='header');
  const row=(r:DemographicOutputRow)=>`<tr class="${r.kind||''}">${r.cells.map(c=>`<${c.kind==='heading'||c.kind==='section'||c.kind==='variable'?'th':'td'}${c.columnSpan?` colspan="${c.columnSpan}"`:''}${c.rowSpan?` rowspan="${c.rowSpan}"`:''} class="${c.kind||''}">${escape(c.text)}</${c.kind==='heading'||c.kind==='section'||c.kind==='variable'?'th':'td'}>`).join('')}</tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(output.title)}</title><style>${style}</style></head><body><h2>${escape(output.title)}</h2>${output.subtitle?`<p>${escape(output.subtitle)}</p>`:''}<table><thead>${headers.map(row).join('')}</thead><tbody>${body.map(row).join('')}</tbody></table><div class="notes">${output.notes.map(n=>`<p>${escape(n)}</p>`).join('')}</div></body></html>`;
}
export function demographicFlatRows(output:DemographicOutput) {
  const pending=new Map<number,{left:number;text:string}>();
  return output.rows.map(row=>{
    const occupied=new Set(pending.keys()),values=Array<string>(output.columnCount).fill('');for(const [column,p] of pending){values[column]=p.text;p.left--;if(!p.left)pending.delete(column);}
    let column=0;
    for(const cell of row.cells){while(column<values.length&&occupied.has(column))column++;values[column]=cell.text;for(let span=1;span<(cell.columnSpan||1);span++)values[column+span]='';if((cell.rowSpan||1)>1)pending.set(column,{left:cell.rowSpan!-1,text:cell.text});column+=cell.columnSpan||1;}
    return values;
  });
}
