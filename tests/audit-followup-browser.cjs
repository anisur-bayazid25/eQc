// Regression coverage for the Muse Spark audit; only controlled demo projects are changed.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const demo = require('../demo/climate-resilience/dataset/03_READY_TO_IMPORT_EQC.json');

(async () => {
 const browser = await chromium.launch({channel:process.env.EQC_BROWSER_CHANNEL || 'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const fixture=structuredClone(demo);
  Object.assign(fixture,{id:'audit',name:'Audit regression',coderName:undefined,updatedAt:1,mapView:undefined,mapDesign:undefined,mapDrafts:[],mapAnnotations:[],mapEdgeStyles:[],hiddenMapCodeIds:[]});
  fixture.codes.forEach((code,index)=>{code.mapPosition={x:200+(index%6)*200,y:200+Math.floor(index/6)*130};});
  fixture.codedSegments.forEach((segment,index)=>{segment.coder=[' Ann ','Ann','   '][index%3];});
  await page.addInitScript(p=>{
   const other={id:'other',name:'Other project',createdAt:1,folders:[],docs:[],codes:[],codedSegments:[],images:[]};
   window.__projects={[p.id]:p,other};
   window.__originalStamps=p.codedSegments.map(s=>s.coder);
   window.qv=new Proxy({
    listProjects:async()=>Object.values(window.__projects).map(p=>({id:p.id,name:p.name})),
    loadProject:async id=>structuredClone(window.__projects[id]),
    saveProject:async p=>{window.__projects[p.id]=structuredClone(p);return {id:p.id};},
    deleteProject:async id=>{delete window.__projects[id];},
    lan:new Proxy({},{get:(_,name)=>String(name).startsWith('on')?()=>{}:async()=>({ok:true})})
   },{get:(target,name)=>target[name]||(String(name).startsWith('on')?()=>{}:async()=>null)});
  },fixture);
  await page.goto(process.env.EQC_PREVIEW_URL || 'http://127.0.0.1:5179');
  const nav=page.locator('.tabs'),svg=page.locator('.map-viewport svg'),undo=page.getByTitle('Undo (Ctrl+Z)',{exact:true});
  await page.getByLabel('Current project').waitFor();
  await nav.getByRole('button',{name:'Visualization',exact:true}).click();
  await page.getByRole('button',{name:'Open current canvas',exact:true}).click();
  await svg.waitFor();
  assert.equal(await undo.isDisabled(),true);
  const initialTimestamp=await page.evaluate(()=>window.__projects.audit.updatedAt);
  const zoom=page.getByLabel('Map zoom',{exact:true});
  await zoom.focus();
  await zoom.press('ArrowRight');
  await nav.getByRole('button',{name:'Workspace',exact:true}).click();
  await page.waitForFunction(before=>window.__projects.audit.mapView && window.__projects.audit.updatedAt>before,initialTimestamp);
  assert.equal(await undo.isDisabled(),true,'View checkpoint must not create an Undo entry');
  await nav.getByRole('button',{name:'Visualization',exact:true}).click();
  await svg.waitFor();
  await page.getByRole('button',{name:'All visualization types',exact:true}).click();

  // Coder lists are normalized before deduplication, including blank attribution.
  for(const [name,label] of [['Heat map','Heat map coder'],['Sankey diagram','Statistical visualization coder'],['Histomap','Statistical visualization coder'],['Dendrogram','Statistical visualization coder']]) {
   await page.getByRole('button',{name:'Create '+name,exact:true}).click();
   const select=page.getByLabel(label,{exact:true});
   assert.deepEqual(await select.locator('option').allTextContents(),['All coders','Ann','Unattributed']);
   await select.selectOption('Ann');
   assert.equal(await select.inputValue(),'Ann');
   await page.getByRole('button',{name:'← All visualizations',exact:true}).click();
  }

  await page.getByRole('button',{name:'Create Heat map',exact:true}).click();
  await page.getByLabel('Heat map coder',{exact:true}).selectOption('Ann');
  await page.getByRole('button',{name:'Generate visualization',exact:true}).click();
  await svg.waitFor();
  await page.waitForFunction(()=>window.__projects.audit.mapDesign?.family==='heat-map');
  const legend=page.locator('[data-map-legend]');
  const legendMenu=page.locator('.map-tools-rail').getByText('Legend',{exact:true});
  if(!await legend.isVisible()){
   await legendMenu.click();
   await page.getByRole('button',{name:'Show legend',exact:true}).click();
   await legendMenu.click();
  }
  assert.equal(await legend.isVisible(),true);
  await page.getByRole('button',{name:'Edit Heat map settings',exact:true}).click();
  await page.getByLabel('Visualization title',{exact:true}).fill('Regenerated audit map');
  await page.getByRole('button',{name:'Generate visualization',exact:true}).click();
  await page.waitForFunction(()=>window.__projects.audit.mapDesign?.options?.title==='Regenerated audit map');
  assert.equal(await legend.isVisible(),true,'Regeneration must retain a visible legend');
  await page.locator('.map-tools-rail').getByText('Drafts',{exact:true}).click();
  await page.getByLabel('Map draft name',{exact:true}).fill('Legend visible');
  await page.getByRole('button',{name:'Save map draft',exact:true}).click();
  await page.waitForFunction(()=>window.__projects.audit.mapDrafts?.length===1);
  assert.equal(await page.evaluate(()=>window.__projects.audit.mapDrafts[0].view.showLegend),true);
  await page.locator('.map-tools-rail').getByText('Drafts',{exact:true}).click();
  await legendMenu.click();
  await page.getByRole('button',{name:'Hide legend',exact:true}).click();
  await legendMenu.click();
  assert.equal(await legend.count(),0);
  await page.getByRole('button',{name:'Edit Heat map settings',exact:true}).click();
  await page.getByLabel('Visualization title',{exact:true}).fill('Hidden legend audit map');
  await page.getByRole('button',{name:'Generate visualization',exact:true}).click();
  await page.waitForFunction(()=>window.__projects.audit.mapDesign?.options?.title==='Hidden legend audit map');
  assert.equal(await legend.count(),0,'Regeneration must also retain a hidden legend');
  await page.getByRole('button',{name:'All visualization types',exact:true}).click();
  await page.getByRole('button',{name:'Open draft',exact:true}).click();
  await legend.waitFor();
  assert.equal(await legend.isVisible(),true,'Draft restore must respect the saved legend');

  // A second view-only checkpoint must advance the edit timestamp as well.
  const beforeViewSave=await page.evaluate(()=>window.__projects.audit.updatedAt);
  await page.getByRole('button',{name:'100%',exact:true}).click();
  await nav.getByRole('button',{name:'Workspace',exact:true}).click();
  await page.waitForFunction(before=>window.__projects.audit.updatedAt>before,beforeViewSave);
  assert.deepEqual(await page.evaluate(()=>window.__projects.audit.codedSegments.map(s=>s.coder)),await page.evaluate(()=>window.__originalStamps));
  await page.evaluate(()=>{
   localStorage.setItem('qda-lan-seq-audit','17');localStorage.setItem('qda-lan-synced-at-audit','23');
   localStorage.setItem('qda-lan-seq-other','31');localStorage.setItem('qda-lan-synced-at-other','37');
  });
  await page.getByTitle('Rename project',{exact:true}).click();
  await page.getByRole('button',{name:'Delete Project...',exact:true}).click();
  await page.getByRole('button',{name:'Yes, proceed',exact:true}).click();
  await page.getByRole('button',{name:'Yes, delete forever',exact:true}).click();
  await page.waitForFunction(()=>!window.__projects.audit && document.querySelector('[aria-label="Current project"]').value==='other');
  assert.deepEqual(await page.evaluate(()=>['qda-lan-seq-audit','qda-lan-synced-at-audit','qda-lan-seq-other','qda-lan-synced-at-other'].map(k=>localStorage.getItem(k))),[null,null,'31','37']);
  assert.deepEqual(errors,[]);
  console.log('Audit UI: four normalized coder lists, unchanged stamps, view timestamps without Undo pollution, visible legend through regeneration/draft restore, and project-scoped LAN cleanup passed.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
