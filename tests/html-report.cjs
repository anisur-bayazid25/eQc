const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {buildReportHtml}=require('../src/lib/report.ts');
const {computeComparison,defaultComparisonSettings,comparisonCoefficient}=require('../src/lib/icrComparisons.ts');
const project={id:'p',name:'Report <script>bad</script>',createdAt:1,folders:[],docs:[{id:'d',name:'Interview <one>',content:'One. Two.\nThree.',addedAt:1}],codes:[{id:'a',name:'Access',parentId:null,summary:'Finding',color:'#123456',createdAt:1},{id:'b',name:'Barrier',parentId:null,summary:'',color:'#654321',createdAt:1}],codedSegments:['Ann','Bob','Cara'].map((coder,i)=>({id:'s'+i,docId:'d',codeId:'a',start:0,end:i===1?4:8,text:'One. Two.',coder,createdAt:1})),cases:[],memos:[]};
const coders=['Ann','Bob','Cara'],scope={docIds:['d'],includeImages:false},extras={icr:{coders,scope,coderA:'Ann',coderB:'Bob'}};
test('HTML includes every saved comparison method with its exact statistics, settings and caveats',()=>{
  for(const method of ['characters','sentences','paragraphs','presence','frequency','segments','domains','training']){
    const settings={...defaultComparisonSettings(project),method,codeIds:['a'],domains:[{name:'Experience',codeIds:['a']}],trainingCoders:['Expert','Trainee'],training:[{unit:'1',coder:'Expert',code:'Access',present:true,rating:1},{unit:'1',coder:'Trainee',code:'Access',present:true,rating:2},{unit:'2',coder:'Expert',code:'Access',present:false,rating:2},{unit:'2',coder:'Trainee',code:'Access',present:true,rating:4}]};
    const result=computeComparison(project,method==='training'?settings.trainingCoders:coders,scope,settings);
    const html=buildReportHtml({...project,icrComparison:settings},extras);
    assert.ok(html.includes(result.title),method);
    for(const row of result.rows){assert.ok(html.includes(row.label.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')),row.label);assert.ok(html.includes(comparisonCoefficient(row)),row.label);}
    assert.ok(html.includes('An absent code is treated as a negative decision'));
    assert.ok(html.includes('ICR calculation details and interpretation'));
    if(method==='training')assert.ok(html.includes('Comparison coders: Expert, Trainee'));
    if(method==='domains')assert.ok(html.includes('Semantic domains: Experience: Access'));
  }
});
test('every report table is collapsed by default and all coder pairs are included',()=>{
  const html=buildReportHtml(project,extras);
  const tables=html.match(/<table\b/g)||[],disclosures=html.match(/<details class="report-table">/g)||[];
  assert.ok(tables.length>=8);assert.equal(tables.length,disclosures.length);
  assert.ok(html.includes('<td>Bob</td><td>Cara</td>'));assert.ok(html.includes('<td>Ann</td><td>Cara</td>'));
  assert.doesNotMatch(html,/<details class="report-table" open/);
  assert.match(html,/Report contents/);assert.match(html,/Find in this table/);
  assert.doesNotMatch(html,/<script>bad<\/script>/);
  assert.match(html,/Report &lt;script&gt;bad&lt;\/script&gt;/);
});
test('draft figures are embedded offline and notes are included only when supplied',()=>{
  const figure={id:'draft',name:'Graph <one>',family:'Sankey diagram',updatedAt:1,svg:'<svg xmlns="http://www.w3.org/2000/svg"><text>Figure &amp; text</text></svg>'};
  let html=buildReportHtml(project,{...extras,draftFigures:[figure]});
  assert.match(html,/data:image\/svg\+xml;charset=utf-8,%3Csvg/);assert.match(html,/Figure 1. Graph &lt;one&gt;/);assert.doesNotMatch(html,/Visualization notes/);
  html=buildReportHtml(project,{...extras,draftFigures:[{...figure,notes:[{title:'Team <note>',text:'<script>private</script>'}]}]});
  assert.match(html,/Visualization notes \(1\)/);assert.match(html,/&lt;script&gt;private&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>private/);
  html=buildReportHtml(project,{...extras,draftFigures:[{...figure,svg:undefined,error:'Unavailable <source>'}]});
  assert.match(html,/Figure unavailable: Unavailable &lt;source&gt;/);
});
test('empty comparison scope and invalid saved settings remain explicit',()=>{
  const html=buildReportHtml({...project,icrComparison:{...defaultComparisonSettings(project),method:'domains',domains:[]}},extras);
  assert.match(html,/Additional ICR comparison unavailable/);
  assert.match(buildReportHtml(project,{icr:{coders:[],scope:{docIds:[],includeImages:false},coderA:'',coderB:''}}),/Coders: None/);
});

test('code summaries collapse individually and research records have separate record-type tables',()=>{
  const data={...project,cases:[{id:'case',name:'Mere',kind:'person',attributes:{Age:'39'},links:[{docId:'d'}]}],annotations:[{id:'note',docId:'d',start:0,end:4,text:'One.',note:'Annotation finding',createdAt:1}],memos:[{id:'analytic',kind:'analytic',title:'Interpretation',text:'Analytic finding',docIds:[],codeIds:[],caseIds:[],segmentIds:[],createdAt:1,updatedAt:1},{id:'method',kind:'methodological',title:'Method',text:'Method decision',docIds:[],codeIds:[],caseIds:[],segmentIds:[],createdAt:1,updatedAt:1}]};
  const html=buildReportHtml(data,extras);
  assert.match(html,/<details class="memo"><summary>Access<\/summary>/);
  assert.doesNotMatch(html,/<details class="memo" open/);
  for(const heading of ['Cases and attributes','Annotations','Analytic memos','Methodological memos','Code memos'])assert.ok(html.includes(`<h3>${heading}</h3><details class="report-table">`),heading);
  assert.match(html,/Analytic finding/);assert.match(html,/Method decision/);assert.match(html,/Annotation finding/);
});
