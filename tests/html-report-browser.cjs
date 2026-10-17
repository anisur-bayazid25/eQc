const {chromium}=require(process.env.EQC_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{spawn}=require('node:child_process');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {buildVisualization,visualizationTypes}=require('../src/lib/visualizations.ts'),{applyCodeMapSuggestion}=require('../src/lib/mapSuggestions.ts'),{saveMapDraft}=require('../src/lib/mapDrafts.ts'),{defaultComparisonSettings}=require('../src/lib/icrComparisons.ts');
const project=structuredClone(require('../demo/climate-resilience/dataset/03_READY_TO_IMPORT_EQC.json'));
project.codedSegments=project.codedSegments.map(s=>({...s,periodId:undefined}));
const drafts=[];
for(const type of visualizationTypes){
  const presets={'mind-map':'simple',hierarchy:'vertical','heat-map':'documents','word-tree':'after',process:'sequence',journey:'stages',pyramid:'levels',venn:'groups',honeycomb:'components',ecology:'network',histomap:'periods',dendrogram:'documents',manual:'blank',sankey:'two-stage'};
  const options={title:type.name+' report figure',preset:presets[type.id]||'simple',codeIds:project.codes.map(c=>c.id),docIds:project.docs.map(d=>d.id),limit:project.codes.length,docLimit:4,phrase:'water',labels:'Before\nDuring\nAfter',ratings:'3, 2, 4',colour:'#2563eb',periods:[{id:'p1',label:'Before',order:0},{id:'p2',label:'After',order:1}],docPeriods:Object.fromEntries(project.docs.map((d,i)=>[d.id,i%2?'p2':'p1'])),cloudWords:[{word:'recovery',count:5,x:100,y:100,width:240,height:55,fontSize:40,rotation:0}]};
  let graph=applyCodeMapSuggestion(project,buildVisualization(project,type.id,options));
  graph.visualizationNotes=[{id:'team',title:'Team task',text:'Optional team note',x:50,y:50,updatedAt:1}];
  const view={width:graph.mapDesign.width,height:graph.mapDesign.height,viewMode:'full',expandedRoots:[],childrenPerRoot:'all',showCooc:true,minShared:1,showLegend:true,includeLegendInExport:true,legendPos:{x:12,y:12}};
  graph=saveMapDraft({...graph,mapDrafts:[]},type.name+' draft',view);drafts.push(graph.mapDrafts[0]);
}
project.mapDrafts=drafts;project.icrComparison={...defaultComparisonSettings(project),method:'characters'};
const server=spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5216','--strictPort'],{stdio:'ignore'});
(async()=>{let browser;try{
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('Preview stopped');try{if((await fetch('http://127.0.0.1:5216')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:process.env.EQC_BROWSER_CHANNEL||'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(p=>{window.__qaProject=p;window.__reports=[];window.qv=new Proxy({listProjects:async()=>[{id:p.id,name:p.name}],loadProject:async()=>window.__qaProject,saveProject:async p=>{window.__qaProject=structuredClone(p);return p;},exportReport:async(p,html)=>{window.__reports.push(html);return 'report.html';},lan:new Proxy({},{get:(_,n)=>String(n).startsWith('on')?()=>{}:async()=>({ok:true})})},{get:(t,n)=>t[n]||(String(n).startsWith('on')?()=>{}:async()=>null)});},project);
  await page.goto('http://127.0.0.1:5216');await page.locator('.tabs').getByRole('button',{name:'Analysis',exact:true}).click();
  const before=await page.evaluate(()=>JSON.stringify(window.__qaProject));
  await page.getByRole('button',{name:'⬇️ HTML Report',exact:true}).click();const dialog=page.getByRole('dialog',{name:'HTML report options',exact:true});await dialog.waitFor();
  assert.equal(await dialog.locator('.report-draft-picker input:checked').count(),visualizationTypes.length);
  assert.equal(await dialog.getByRole('checkbox',{name:'Include selected drafts’ visualization notes',exact:true}).isChecked(),false);
  await dialog.getByRole('button',{name:'Export HTML report',exact:true}).click();await dialog.waitFor({state:'hidden',timeout:60000});
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__qaProject)),before);
  const html=await page.evaluate(()=>window.__reports.at(-1));assert.ok(html.includes('Additional ICR comparison: Characters'));assert.doesNotMatch(html,/Figure unavailable/);assert.doesNotMatch(html,/Optional team note/);
  const report=await browser.newPage({viewport:{width:1440,height:1000}});report.on('pageerror',error=>errors.push(error.message));const requests=[];report.on('request',request=>requests.push(request.url()));await report.setContent(html);
  assert.equal(await report.locator('figure img').count(),visualizationTypes.length);await report.waitForFunction(()=>Array.from(document.querySelectorAll('figure img')).every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await report.locator('details.report-table[open]').count(),0);assert.equal(await report.locator('details.report-table table').count(),await report.locator('table').count());
  const memo=report.locator('details.memo').first();assert.equal(await memo.getAttribute('open'),null);await memo.locator('summary').click();assert.notEqual(await memo.getAttribute('open'),null);await memo.locator('summary').click();
  assert.ok(await report.locator('section h3').filter({hasText:'Cases and attributes'}).count());
  await report.getByRole('button',{name:'Expand all sections',exact:true}).click();assert.equal(await report.locator('details.report-table[open]').count(),await report.locator('table').count());
  assert.equal(await report.locator('details:not([open])').count(),0);
  const first=report.locator('details.report-table').first();await first.getByRole('searchbox').fill('no-match-ever');assert.equal(await first.locator('tbody tr:not([hidden])').count(),0);
  await report.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.ok(await first.locator('tbody tr:not([hidden])').count()>0);await report.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await first.locator('tbody tr:not([hidden])').count(),0);await first.getByRole('searchbox').fill('');
  await report.getByRole('button',{name:'Collapse all sections',exact:true}).click();assert.equal(await report.locator('details.report-table[open]').count(),0);
  assert.equal(await report.locator('details[open]').count(),0);
  const out=path.resolve('release/html-report-qa');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'Climate_demo_analysis_report.html'),html);
  await report.evaluate(()=>window.scrollTo(0,0));await report.screenshot({path:path.join(out,'html-report-desktop.png')});
  await report.locator('summary[aria-label="All selected coder pairs table"]').click();await report.getByRole('heading',{name:'Inter-Coder Reliability (ICR)',exact:true}).scrollIntoViewIfNeeded();await report.screenshot({path:path.join(out,'html-report-icr.png')});await report.getByRole('button',{name:'Collapse all sections',exact:true}).click();
  for(const width of [900,640,390]){await report.setViewportSize({width,height:900});assert.equal(await report.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  await report.screenshot({path:path.join(out,'html-report-mobile.png')});assert.ok(requests.every(url=>url.startsWith('data:')));
  await page.getByRole('button',{name:'⬇️ HTML Report',exact:true}).click();await dialog.getByRole('button',{name:'Clear graph selection',exact:true}).click();await dialog.getByRole('checkbox',{name:'Sankey diagram draft',exact:true}).check();await dialog.getByRole('checkbox',{name:'Include selected drafts’ visualization notes',exact:true}).check();await dialog.getByRole('button',{name:'Export HTML report',exact:true}).click();await dialog.waitFor({state:'hidden'});const notesHtml=await page.evaluate(()=>window.__reports.at(-1));assert.match(notesHtml,/Optional team note/);assert.equal((notesHtml.match(/<figure /g)||[]).length,1);
  const fallback=await browser.newContext({javaScriptEnabled:false});const staticReport=await fallback.newPage();await staticReport.setContent(html);await staticReport.locator('details.report-table summary').first().click();assert.equal(await staticReport.locator('details.report-table[open]').count(),1);await fallback.close();
  assert.deepEqual(errors,[]);console.log('HTML report: all 17 graph families, optional draft notes, unchanged project, ICR, table disclosure/search/print, offline images, script-free disclosure and responsive layout passed.');
}finally{if(browser)await browser.close();server.kill();}})().catch(error=>{console.error(error);process.exitCode=1;});
