import {saveExport} from '../lib/spreadsheetExport';
import React,{useMemo,useState} from 'react';

export default function IcrResultsTable({title,headers,rows,onMessage}:{title:string;headers:string[];rows:(string|number)[][];onMessage:(message:string)=>void}) {
  const [search,setSearch]=useState(''),[page,setPage]=useState(0);
  const filtered=useMemo(()=>rows.filter(row=>row.some(value=>String(value).toLocaleLowerCase().includes(search.toLocaleLowerCase()))),[rows,search]);
  const current=Math.min(page,Math.max(0,Math.ceil(filtered.length/20)-1));
  async function download(kind:'xlsx'|'docx'){try{const filenameBase=title.replace(/[^\p{L}\p{N}\s_-]/gu,'').slice(0,100);const path=kind==='xlsx'?await saveExport({title,defaultName:filenameBase+'.xlsx',extension:'xlsx',filterName:'Excel workbook',content:[headers,...rows].map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n')}):await window.qv.exportDocxTable({kind:'table',title,filenameBase,headers,rows});if(path)onMessage('Exported '+title+'.');}catch(error){onMessage(error instanceof Error?error.message:String(error));}}
  return <div className="icr-table-browser"><div className="icr-table-actions"><label>Find a result<input type="search" aria-label={'Find result in '+title} value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label><span>{filtered.length} results</span><button onClick={()=>download('xlsx')}>Export Excel</button><button onClick={()=>download('docx')}>Export Word</button></div>
    <div className="matrix-wrap icr-result-scroll"><table className="matrix-table"><thead><tr>{headers.map(header=><th key={header}>{header}</th>)}</tr></thead><tbody>{filtered.slice(current*20,current*20+20).map((row,index)=><tr key={index}>{row.map((value,i)=><td key={i}>{value}</td>)}</tr>)}</tbody></table></div>
    {!filtered.length&&<p className="empty-hint">No matching results.</p>}
    {filtered.length>20&&<div className="icr-table-actions"><button disabled={!current} onClick={()=>setPage(current-1)}>Previous results</button><span>Page {current+1} of {Math.ceil(filtered.length/20)}</span><button disabled={(current+1)*20>=filtered.length} onClick={()=>setPage(current+1)}>Next results</button></div>}
    <small>Exports contain every result, regardless of the search or page.</small>
  </div>;
}
