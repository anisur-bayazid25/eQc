import Papa from 'papaparse';

/** Keep the existing table builders, but save spreadsheet exports as real XLSX. */
export async function saveExport(payload:{title:string;defaultName:string;content:string;extension:string;filterName:string}) {
  if(!['xlsx','csv'].includes(payload.extension.toLowerCase()))return window.qv.exportText(payload);
  const parsed=Papa.parse<string[]>(payload.content.replace(/^\uFEFF/,''),{header:false,dynamicTyping:false,delimiter:',',skipEmptyLines:false});
  if(parsed.errors.length)throw Error('Could not prepare spreadsheet: '+parsed.errors[0].message);
  const rows=parsed.data;
  if(rows.length>1&&rows[rows.length-1].length===1&&rows[rows.length-1][0]==='')rows.pop();
  const headers=rows[0]||[''],width=rows.reduce((max,row)=>Math.max(max,row.length),1);
  return window.qv.exportMemoWorkbook({title:payload.title,filenameBase:payload.defaultName.replace(/\.(csv|xlsx)$/i,''),sheets:[{name:'Data',headers,rows:rows.slice(1),autoFilter:headers.length===width,freezeHeader:headers.length===width}]});
}
