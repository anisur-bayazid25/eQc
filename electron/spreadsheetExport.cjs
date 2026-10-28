const Papa=require('papaparse');
const {buildMemoWorkbook}=require('./memoWorkbook.cjs');

// Tabular export builders share a delimited interchange grid internally.
// The saved file is an actual Open XML workbook, with literal text cells.
async function buildSpreadsheetExport(content) {
  const result=Papa.parse(String(content??'').replace(/^\uFEFF/,''),{header:false,dynamicTyping:false,delimiter:',',skipEmptyLines:false});
  if(result.errors.length)throw Error('Could not prepare spreadsheet: '+result.errors[0].message);
  const rows=result.data;
  if(rows.length>1&&rows.at(-1).length===1&&rows.at(-1)[0]==='')rows.pop();
  const width=rows.reduce((width,row)=>Math.max(width,row.length),1);
  const headers=rows[0]||[''];
  return buildMemoWorkbook([{name:'Data',headers,rows:rows.slice(1),autoFilter:headers.length===width,freezeHeader:headers.length===width}]);
}
module.exports={buildSpreadsheetExport};
