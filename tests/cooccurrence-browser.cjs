const {chromium}=require(process.env.EQC_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
const server=spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5241','--strictPort'],{stdio:'ignore'});
(async()=>{let browser;try{
 let ready=false;for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('Preview stopped');try{if((await fetch('http://127.0.0.1:5241')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 browser=await chromium.launch({channel:process.env.EQC_BROWSER_CHANNEL||'msedge',headless:true});const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const p={id:'network-qa',name:'Recovery relationships',createdAt:1,folders:[],docs:[{id:'d1',name:'Interview A',content:'Water access affects care work and household income. Recovery needs support.',addedAt:1},{id:'d2',name:'Interview B',content:'Water access and care work overlap. Recovery needs support.',addedAt:1}],codes:['Water access','Care work','Household income','Recovery','Support','Unused code'].map((name,i)=>({id:'c'+i,name,summary:'',color:'#2563eb',parentId:null,createdAt:1})),codedSegments:[]};
  const ranges=[[0,0,30],[1,10,40],[2,20,50],[3,52,73],[4,60,73]];
  for(const doc of p.docs)for(const [i,start,end] of ranges)p.codedSegments.push({id:doc.id+'c'+i,docId:doc.id,codeId:'c'+i,start,end:Math.min(end,doc.content.length),coder:'Amina',text:doc.content.slice(start,end),createdAt:1});
  p.codedSegments=p.codedSegments.filter(s=>s.end>s.start);
  window.__qaProject=p;window.__exports=[];window.qv=new Proxy({listProjects:async()=>[{id:p.id,name:p.name}],loadProject:async()=>window.__qaProject,saveProject:async value=>{window.__qaProject=structuredClone(value);return value;},exportText:async value=>{window.__exports.push(value);return 'graph.svg';},lan:new Proxy({},{get:(_,n)=>String(n).startsWith('on')?()=>{}:async()=>({ok:true})})},{get:(t,n)=>t[n]||(String(n).startsWith('on')?()=>{}:async()=>null)});
 });
 await page.goto('http://127.0.0.1:5241');await page.locator('.tabs').getByRole('button',{name:'Visualization',exact:true}).click();
 const svg=page.locator('.map-viewport svg'),generate=()=>page.getByRole('button',{name:'Generate visualization',exact:true}).click(),back=()=>page.getByRole('button',{name:'All visualization types',exact:true}).click();
 const out=path.resolve('release/cooccurrence-qa');fs.mkdirSync(out,{recursive:true});
 const dragHandle=async part=>{const handle=svg.locator(`[data-map-line-handle="${part}"]`);const box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+28,box.y+box.height/2+18,{steps:6});await page.mouse.up();};
 const clickPath=async path=>{const p=await path.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.5),m=el.getScreenCTM();return {x:p.x*m.a+p.y*m.c+m.e,y:p.x*m.b+p.y*m.d+m.f};});await page.mouse.click(p.x,p.y);};
 const editNumber=async()=>{
  const count=svg.locator('[data-map-annotation*="count:"]').first(),id=await count.getAttribute('data-map-annotation'),box=await count.locator('[data-map-hit-target]').boundingBox();
  const original=await page.evaluate(id=>structuredClone(window.__qaProject.mapAnnotations.find(a=>a.id===id)),id);
  await page.mouse.dblclick(box.x+box.width*.25,box.y+box.height*.25);
  await page.getByLabel('Edit map text in place',{exact:true}).fill('42');await page.getByLabel('Edit map text in place',{exact:true}).press('Control+Enter');
  await page.waitForFunction(id=>window.__qaProject.mapAnnotations.find(a=>a.id===id)?.text==='42',id);
  await page.getByLabel('Label background colour hex and palette',{exact:true}).click();await page.getByLabel('Label background colour hex',{exact:true}).fill('#e0f2fe');await page.getByLabel('Label background colour hex',{exact:true}).press('Enter');await page.getByLabel('Label background colour hex and palette',{exact:true}).click();
  const opacity=page.getByLabel('Label background opacity',{exact:true});await opacity.focus();await opacity.press('Home');for(let i=0;i<7;i++)await opacity.press('ArrowRight');
  const edited=await page.evaluate(id=>window.__qaProject.mapAnnotations.find(a=>a.id===id),id);assert.equal(edited.fill,'#e0f2fe');assert.ok(Math.abs(edited.fillOpacity-.35)<1e-6);assert.deepEqual(edited.coocPair,original.coocPair);
  assert.equal(await count.locator('[data-map-label-background]').getAttribute('fill'),'#e0f2fe');
  await page.locator('summary[data-tool="Export"]').click();await page.getByRole('button',{name:/SVG$/}).click();const exported=await page.evaluate(()=>window.__exports.at(-1).content);assert.ok(exported.includes('#e0f2fe'));assert.ok(!exported.includes('data-map-hit-target')&&!exported.includes('data-map-edit-outline'));await page.keyboard.press('Escape');
 };
 for(const preset of ['clusters','circle','sphere']){
  await page.getByRole('button',{name:'Create Co-occurrence network',exact:true}).click();await page.getByLabel('Visualization preset',{exact:true}).selectOption(preset);
  assert.match(await page.getByRole('region',{name:'Co-occurrence settings',exact:true}).innerText(),/Scope preview/);await generate();await svg.waitFor();
  await page.waitForFunction(preset=>window.__qaProject.mapDesign?.family==='cooccurrence-network'&&window.__qaProject.mapDesign.options.preset===preset,preset);
  assert.ok(await svg.locator('radialGradient').count()>0);assert.equal(await svg.locator('[data-map-code]').count(),0);
  const edges=await page.evaluate(()=>window.__qaProject.mapAnnotations.filter(a=>a.coocPair));assert.ok(edges.length>0);
  await svg.locator(`[data-map-annotation="${edges[0].id}"]`).dispatchEvent('click');
  if(await page.getByRole('button',{name:'Toggle inspector',exact:true}).getAttribute('aria-pressed')==='false')await page.getByRole('button',{name:'Toggle inspector',exact:true}).click();
  await page.getByRole('region',{name:'Co-occurrence evidence',exact:true}).waitFor();assert.match(await page.getByRole('region',{name:'Co-occurrence evidence',exact:true}).innerText(),/Relationship count:/);
  const node=svg.locator('[data-map-annotation^="suggested:network:node:"]').first(),before=await node.boundingBox();await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(before.x+before.width/2+35,before.y+before.height/2+20,{steps:8});await page.mouse.up();
  const after=await node.boundingBox();assert.ok(Math.abs(after.x-before.x)>10,'Nodes can be moved');
  await page.screenshot({path:path.join(out,preset+'.png')});
  if(preset==='sphere'){
   const attached=svg.locator(`[data-map-annotation="${edges[0].id}"]`);await clickPath(attached.locator('path').first());assert.equal(await svg.locator('[data-map-line-handle]').count(),2);await dragHandle('end');
   const detached=await page.evaluate(id=>window.__qaProject.mapAnnotations.find(a=>a.id===id),edges[0].id);assert.equal(detached.fromAnnotationId,undefined);assert.equal(detached.toAnnotationId,undefined);assert.deepEqual(detached.coocPair,edges[0].coocPair);

   await page.locator('summary[data-tool="Drafts"]').click();await page.getByLabel('Map draft name',{exact:true}).fill('Spherical relationships');await page.getByRole('button',{name:'Save map draft',exact:true}).click();await page.waitForFunction(()=>window.__qaProject.mapDrafts?.length===1);
   await page.keyboard.press('Escape');await page.locator('summary[data-tool="Export"]').click();await page.getByRole('button',{name:/SVG$/}).click();await page.waitForFunction(()=>window.__exports.length>0);const exported=await page.evaluate(()=>window.__exports.at(-1));assert.ok(JSON.stringify(exported).includes('radialGradient'));await page.keyboard.press('Escape');
  }
  await back();
 }
 for(const [preset,style] of [['spatial','text'],['spatial','flat'],['spatial','ball'],['chord','ball']]){
  await page.getByRole('button',{name:'Create Co-occurrence network',exact:true}).click();await page.getByLabel('Visualization preset',{exact:true}).selectOption(preset);
  if(preset!=='chord')await page.getByLabel('Network node appearance',{exact:true}).selectOption(style);
  await generate();await svg.waitFor();await page.waitForFunction(({preset,style})=>window.__qaProject.mapDesign.options.preset===preset&&(preset==='chord'||window.__qaProject.mapDesign.options.coocNodeStyle===style),{preset,style});
  if(preset==='chord')assert.ok(await svg.locator('[data-map-annotation^="suggested:chord:ribbon:"]').count()>0);
  else if(style==='text'){assert.equal(await svg.locator('ellipse').count(),0);assert.ok(await svg.locator('[data-map-annotation^="suggested:network:node:"] text').count()>0);}
  else assert.equal(await svg.locator('radialGradient').count()>0,style==='ball');
  if(preset==='chord'){
   const leader=svg.locator('[data-map-annotation^="suggested:chord:leader:"]').filter({has:page.locator('path')}).nth(1),id=await leader.getAttribute('data-map-annotation');
   await clickPath(leader.locator('path').first());assert.equal(await svg.locator('[data-map-line-handle]').count(),2);
   const before=await page.evaluate(id=>window.__qaProject.mapAnnotations.find(a=>a.id===id).x2,id);await dragHandle('end');assert.notEqual(await page.evaluate(id=>window.__qaProject.mapAnnotations.find(a=>a.id===id).x2,id),before);
   await page.getByLabel('Graph line width',{exact:true}).fill('4');assert.equal(await page.evaluate(id=>window.__qaProject.mapAnnotations.find(a=>a.id===id).strokeWidth,id),4);
   await editNumber();
  }
  await page.screenshot({path:path.join(out,preset+'-'+style+'.png')});await back();
 }
 for(const name of ['Heat map','Sankey diagram']){
  await page.getByRole('button',{name:'Create '+name,exact:true}).click();await page.getByLabel('Visualization preset',{exact:true}).selectOption('cooccurrence');await generate();await svg.waitFor();
  await page.waitForFunction(name=>document.querySelector('.map-title')?.textContent===name,name);
  if(name==='Sankey diagram')await svg.locator('[data-map-annotation^="suggested:sankey:count:"]').first().waitFor();
  assert.ok((await page.evaluate(()=>window.__qaProject.mapAnnotations.filter(a=>a.coocPair).length))>0);
  await page.screenshot({path:path.join(out,name==='Heat map'?'heat-map.png':'sankey.png')});
  if(name==='Sankey diagram'){
   const ribbon=svg.locator('[data-map-annotation^="suggested:sankey:link:"]').first(),id=await ribbon.getAttribute('data-map-annotation'),original=await page.evaluate(id=>structuredClone(window.__qaProject.mapAnnotations.find(a=>a.id===id)),id);
   const point=await ribbon.locator('polygon').evaluate(el=>{const box=el.getBBox(),matrix=el.getScreenCTM();for(let i=1;i<20;i++)for(let j=1;j<20;j++){const p=new DOMPoint(box.x+box.width*i/20,box.y+box.height*j/20);if(!el.isPointInFill(p))continue;const screen=p.matrixTransform(matrix);if(document.elementFromPoint(screen.x,screen.y)?.closest('[data-map-annotation]')===el.parentElement)return{x:screen.x,y:screen.y};}throw Error('No exposed ribbon point');});
   await page.mouse.click(point.x,point.y);const corner=await svg.locator('[data-map-resize="se"]').boundingBox();await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);await page.mouse.down();await page.mouse.move(corner.x+corner.width/2+15,corner.y+corner.height/2+10,{steps:5});await page.mouse.up();
   const resized=await page.evaluate(id=>window.__qaProject.mapAnnotations.find(a=>a.id===id),id);assert.equal(resized.flowManual,true);assert.deepEqual(resized.flow,original.flow);assert.deepEqual(resized.coocPair,original.coocPair);assert.notEqual(resized.width,original.width);
   await editNumber();assert.ok(await svg.locator('[data-map-annotation^="suggested:sankey:count:"]').count()>0);await back();}
  else {await page.getByRole('button',{name:'Edit Heat map settings',exact:true}).click();await page.getByLabel('Co-occurrence relationship',{exact:true}).selectOption('documents');await generate();await svg.waitFor();assert.match(await page.evaluate(()=>window.__qaProject.mapDesign.description),/Shared text documents/);await back();}
 }
 const draft=page.locator('.map-draft-row').filter({hasText:'Spherical relationships'});await draft.getByRole('button',{name:'Open draft',exact:true}).click();await svg.waitFor();assert.ok(await svg.locator('radialGradient').count()>0);
 await back();await page.getByRole('button',{name:'Create Mind map',exact:true}).click();await generate();await svg.waitFor();
 const edge=svg.locator('[data-map-edge]').first();await edge.waitFor();await clickPath(edge.locator('path').first());assert.equal(await svg.locator('[data-map-line-handle]').count(),2);
 await dragHandle('end');let edgeStyle=await page.evaluate(()=>window.__qaProject.mapEdgeStyles.find(e=>e.lineEnd));assert.ok(edgeStyle?.lineStart&&edgeStyle.lineEnd);
 const before=structuredClone(edgeStyle);const line=svg.locator(`[data-map-edge]`).first().locator('path').first(),point=await line.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.45),m=el.getScreenCTM();return{x:p.x*m.a+p.y*m.c+m.e,y:p.x*m.b+p.y*m.d+m.f};});
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+20,point.y+10,{steps:5});await page.mouse.up();edgeStyle=await page.evaluate(()=>window.__qaProject.mapEdgeStyles.find(e=>e.lineEnd));assert.notEqual(edgeStyle.lineStart.x,before.lineStart.x);assert.ok(Math.abs((edgeStyle.lineEnd.x-edgeStyle.lineStart.x)-(before.lineEnd.x-before.lineStart.x))<1e-6);
 await page.locator('summary[data-tool="Link"]').click();await page.getByRole('button',{name:'Reset line position',exact:true}).click();assert.ok((await page.evaluate(()=>window.__qaProject.mapEdgeStyles)).every(e=>!e.lineEnd&&!e.lineStart));await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('Co-occurrence UI: all layouts, spatial 3D, text/flat/ball nodes, chord, scope, evidence, dragging, ball SVG export, drafts, matrix, counted Sankey, line movement/endpoints, number text and background formatting passed.');
}finally{if(browser)await browser.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
