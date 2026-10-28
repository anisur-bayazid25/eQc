const {Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,BorderStyle,AlignmentType}=require('docx');

function buildDemographicDocx(output) {
  const font=output.font==='serif'?'Times New Roman':'Arial',size=output.fontSize*2;
  const none={style:BorderStyle.NONE,size:0,color:'FFFFFF'},rule={style:BorderStyle.SINGLE,size:6,color:'555555'};
  const paragraph=(text,bold=false,align)=>new Paragraph({alignment:align,spacing:{after:60},children:[new TextRun({text:String(text??''),font,size,bold,color:'222222'})]});
  const rows=output.rows.map(row=>new TableRow({tableHeader:row.kind==='header',cantSplit:true,children:row.cells.map(cell=>new TableCell({
    columnSpan:cell.columnSpan,rowSpan:cell.rowSpan,
    margins:{top:70,bottom:70,left:100,right:100},
    borders:output.style==='grid'?{top:rule,bottom:rule,left:rule,right:rule}:{top:row.kind==='section'||row.kind==='total'?rule:none,bottom:row.kind==='header'?rule:none,left:none,right:none},
    shading:row.kind==='section'&&output.style==='banded'?{fill:'DCE8F2'}:undefined,
    children:[paragraph(cell.text,['heading','section','variable'].includes(cell.kind)||row.kind==='total',cell.kind==='number'?AlignmentType.RIGHT:AlignmentType.LEFT)]
  }))}));
  const table=new Table({width:{size:100,type:WidthType.PERCENTAGE},rows,borders:{top:rule,bottom:rule,left:none,right:none,insideHorizontal:none,insideVertical:none}});
  return new Document({sections:[{properties:{page:{size:{orientation:output.columnCount>7?'landscape':'portrait'}}},children:[
    new Paragraph({spacing:{after:160},children:[new TextRun({text:output.title,font,bold:true,size:size+4,color:'222222'})]}),
    ...(output.subtitle?[paragraph(output.subtitle)]:[]),table,
    ...output.notes.map(text=>new Paragraph({spacing:{before:100,after:50},children:[new TextRun({text,font,size:18,color:'444444'})]}))
  ]}]});
}
module.exports={buildDemographicDocx};
