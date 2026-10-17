const {chromium}=require(process.env.EQC_PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const project=require('../demo/climate-resilience/dataset/03_READY_TO_IMPORT_EQC.json');
project.docs.push({id:'empty-source',name:'Empty source',content:'',addedAt:1});
const server=spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5209','--strictPort'],{stdio:'ignore'});
(async()=>{let browser;try{
 let ready=false;for(let i=0;i<170;i++){if(server.exitCode!==null)throw Error('Preview exited');try{if((await fetch('http://127.0.0.1:5209')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 browser=await chromium.launch({channel:process.env.EQC_BROWSER_CHANNEL||'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(p=>{window.__qaProject=p;window.qv=new Proxy({listProjects:async()=>[{id:p.id,name:p.name}],loadProject:async()=>window.__qaProject,saveProject:async p=>{window.__qaProject=structuredClone(p);return {id:p.id};},lan:new Proxy({},{get:(_,n)=>String(n).startsWith('on')?()=>{}:async()=>({ok:true})})},{get:(t,n)=>t[n]||(String(n).startsWith('on')?()=>{}:async()=>null)});},project);
 await page.goto('http://127.0.0.1:5209');
 await page.locator('.tabs').getByRole('button',{name:'Visualization',exact:true}).click();
 await page.locator('.visualization-card').first().waitFor();
 const types=await page.locator('.visualization-card').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),out=path.resolve('release/toolbar-qa');fs.mkdirSync(out,{recursive:true});
 for(const type of types){
  await page.getByRole('button',{name:type,exact:true}).click();
  if(type==='Create Code map')await page.getByRole('button',{name:'Use this design',exact:true}).click();
  else{if(type==='Create Word tree')await page.getByLabel('Word tree phrase',{exact:true}).fill('water');await page.getByRole('button',{name:type==='Create Blank canvas'?'Start blank canvas':'Generate visualization',exact:true}).click();}
  await page.locator('.map-viewport svg').waitFor();
  const graphName=type.replace(/^Create /,''),help=page.locator('.tool-menu').filter({has:page.locator('summary[data-tool="Help"]')});
  await help.locator('summary').click();
  assert.equal(await help.locator('.tool-menu-content > strong').textContent(),graphName+' help');
  const guidance={
   'Code map':'shared-document links','Mind map':'branching codes and subcodes','Hierarchy':'parent codes and their subcodes',
   'Co-occurrence network':'overlapping coding-range pairs','Word cloud':'word frequency','Sankey diagram':'weighted ribbons','Heat map':'Hide all-zero rows',
   'Word tree':'phrase occurrences','Process map':'sequence, cycle or branching process','Journey map':'researcher-assigned experience ratings',
   'Pyramid':'top level to the base','Venn diagram':'two or three researcher-defined conceptual groups',
   'Honeycomb':'hexagons','Ecology map':'nested system layers','Histomap':'ordered event periods',
   'Dendrogram':'coding-presence similarity','Blank canvas':'no analysis is generated automatically'
  };
  const helpText=await help.locator('.tool-menu-content').innerText();
  assert.ok(helpText.toLowerCase().includes(guidance[graphName].toLowerCase()),graphName);
  if(graphName!=='Code map')assert.doesNotMatch(helpText,/Use View|Re-layout|Node size reflects coding frequency/,graphName);
  await help.locator('summary').click();
  const rail=page.getByRole('complementary',{name:'Drawing tools',exact:true});
  const common=await rail.evaluate(el=>Array.from(el.children).filter(n=>n.matches('button,details')).map(n=>n.matches('details')?n.querySelector('summary').textContent:n.textContent.replace(/^T/,'')));
  assert.deepEqual(common,['Colours','Text','Canvas','Arrange','Draw','Legend','Drafts','Export'],type);
  const codeNodes=['Create Code map','Create Mind map','Create Hierarchy','Create Blank canvas'].includes(type);
  assert.equal(await rail.locator('.map-graph-tools').count(),codeNodes?1:0,type);
  assert.equal(await rail.locator('[data-tool="View"]').count(),type==='Create Code map'?1:0,type);
  assert.equal(await rail.locator('[data-tool="Legend"]').count(),1,type);
  assert.equal(await rail.getByTitle('Toggle the legend overlay',{exact:true}).count(),0);
  assert.equal(await rail.locator('[data-tool="Shapes"]').count(),0);
  await rail.locator('[data-tool="Draw"]').click();
  assert.equal(await rail.locator('.map-shape-gallery button').count(),21);
  assert.equal(await rail.getByRole('button',{name:'Draw code connection',exact:true}).isVisible(),false);
  await rail.locator('[data-tool="Draw"]').click();
  if(codeNodes){await rail.locator('[data-tool="Link"]').click();assert.equal(await rail.getByRole('button',{name:'Draw code connection',exact:true}).isVisible(),true);await rail.locator('[data-tool="Link"]').click();}
  if(type==='Create Code map'){
   for(const width of [1440,1000,640]){
    await page.setViewportSize({width,height:720});
    const overflow=await rail.evaluate(el=>{const failures=[];for(const item of el.querySelectorAll('.tool-menu>summary,.map-text-tool')){const box=item.getBoundingClientRect(),walker=document.createTreeWalker(item,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);const text=range.getBoundingClientRect();if(text.right>box.right-1||text.left<box.left)failures.push(item.textContent);}}return {failures,scrolls:el.scrollHeight>el.clientHeight,horizontal:el.scrollWidth>el.clientWidth+1};});
    assert.deepEqual(overflow.failures,[],`Code map labels fit at ${width}px`);assert.equal(overflow.horizontal,false);assert.equal(overflow.scrolls,true);
    await page.screenshot({path:path.join(out,'code-map-toolbar-'+width+'.png')});
   }
   await page.setViewportSize({width:1440,height:1000});
   await rail.locator('[data-tool="View"]').click();assert.equal(await rail.getByRole('button',{name:/Legend/}).count(),0);await rail.locator('[data-tool="View"]').click();
   await page.screenshot({path:path.join(out,'code-map-tools.png')});
  }
  if(type==='Create Word cloud'){
   await page.getByRole('button',{name:'Toggle inspector',exact:true}).click();
   await rail.getByRole('button',{name:'Text',exact:true}).click();
   assert.equal(await page.getByRole('complementary',{name:'Text and appearance inspector'}).isVisible(),true);
   for(const width of [1440,900,640]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await rail.getByRole('button',{name:'Text',exact:true}).isVisible(),true);await page.screenshot({path:path.join(out,'word-cloud-tools-'+width+'.png')});}
   await page.setViewportSize({width:1440,height:1000});
  }
  if(type==='Create Heat map'){
   const cells=()=>page.evaluate(()=>window.__qaProject.mapAnnotations.filter(a=>a.kind==='rect'&&a.sourceCodeIds));
   const original=await cells(),sum=rows=>rows.reduce((n,a)=>n+Number(a.text),0),research=await page.evaluate(()=>JSON.stringify([window.__qaProject.docs,window.__qaProject.codedSegments]));
   await page.locator('[data-map-annotation="suggested:viz:0"] text').click();await page.keyboard.press('Delete');
   await page.getByLabel('Hide all-zero rows',{exact:true}).check();
   await page.waitForFunction(()=>window.__qaProject.mapDesign.options.heatHideZeroRows===true);
   assert.ok((await cells()).length<original.length);
   await page.getByLabel('Hide all-zero columns',{exact:true}).check();
   await page.waitForFunction(()=>window.__qaProject.mapDesign.options.heatHideZeroColumns===true);
   const compact=await cells();assert.equal(sum(compact),sum(original));assert.ok(!compact.some(a=>a.sourceDocIds.includes('empty-source')));
   await page.getByLabel('Swap rows and columns',{exact:true}).check();
   await page.waitForFunction(()=>window.__qaProject.mapDesign.options.heatTranspose===true);
   assert.equal(sum(await cells()),sum(original));assert.equal(await page.locator('[data-map-annotation="suggested:viz:0"]').count(),0);
   await page.screenshot({path:path.join(out,'heat-map-compact-transposed.png')});
   await page.getByLabel('Hide all-zero rows',{exact:true}).uncheck();await page.getByLabel('Hide all-zero columns',{exact:true}).uncheck();await page.getByLabel('Swap rows and columns',{exact:true}).uncheck();
   assert.equal((await cells()).length,original.length);assert.equal(await page.evaluate(()=>JSON.stringify([window.__qaProject.docs,window.__qaProject.codedSegments])),research);
  }
  await page.getByRole('button',{name:'All visualization types',exact:true}).click();
 }
 assert.equal(types.length,17);assert.deepEqual(errors,[]);
 await page.locator('.tabs').getByRole('button',{name:'Help',exact:true}).click();
 await page.getByLabel('Search documentation').fill('');
 for(const name of ['Sankey diagram','Word cloud','Histomap','Dendrogram'])assert.ok((await page.locator('.help-sections').textContent()).includes(name));
 console.log('All 17 types: common/contextual tools, shapes under Draw, one Legend, Text/Inspector and responsive layout. Heat-map empty-axis filters/transpose retain counts, heading deletion and sources.');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
