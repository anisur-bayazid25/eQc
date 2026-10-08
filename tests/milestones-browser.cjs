const {chromium}=require(process.env.EQC_PLAYWRIGHT_PATH||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  if(!localStorage.getItem('eqc-profiles-v2')){
   const rows=Array.from({length:50},(_,i)=>({id:'s'+i,day:'2026-10-01',projectId:'p'+i,projectName:'Study '+i,appMs:i?60000:360000000,codingMs:i?60000:360000000,start:1+i,end:360000001+i,firstCoding:1+i,lastCoding:2+i}));
   for(const day of [...Array.from({length:12},(_,i)=>`2025-${String(i+1).padStart(2,'0')}-15`),'2026-09-01','2026-09-07','2026-09-14','2026-09-21','2026-09-28','2026-10-02','2026-10-03','2026-10-04','2026-10-05'])rows.push({id:day,day,projectId:'p0',projectName:'Study 0',appMs:60000,codingMs:60000,start:100,end:60100,firstCoding:100,lastCoding:101});
   localStorage.setItem('eqc-profiles-v2',JSON.stringify({version:2,activeId:'milestone-profile',profiles:[{id:'milestone-profile',details:{name:'Milestone QA',email:'',designation:'',organization:'',photo:'',paused:true,identityUpdatedAt:1},records:rows,updatedAt:1,lastWorkedAt:360000001}]}));
  }
  const project={id:'p0',name:'Study 0',createdAt:1,folders:[],docs:[{id:'d',name:'Document',content:'A passage to read.',addedAt:1,folderId:null}],codes:[{id:'c',name:'Theme',parentId:null,color:'#2563eb',createdAt:1}],codedSegments:[{id:'a',docId:'d',codeId:'c',start:0,end:9,text:'A passage',coder:'A',createdAt:1}],images:[],codedRegions:[]};
  window.qv=new Proxy({listProjects:async()=>[{id:project.id,name:project.name}],loadProject:async()=>project,saveProject:async p=>p,lan:new Proxy({},{get:(_,n)=>String(n).startsWith('on')?()=>{}:async()=>({ok:true})})},{get:(t,n)=>t[n]||(String(n).startsWith('on')?()=>{}:async()=>null)});
 });
 await page.clock.install({time:new Date('2026-10-08T10:00:00')});await page.goto(process.env.EQC_PREVIEW_URL||'http://127.0.0.1:5173');await page.locator('.workspace-sources .doc-row').first().click();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.getByTitle('Profile & time',{exact:true}).click();await page.getByRole('dialog',{name:'A little spark'}).waitFor();assert.equal(await page.locator('.milestone-badge').count(),15);
 await page.getByRole('button',{name:'View remaining later'}).click();assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Back to Workspace'}).click();await page.getByTitle('Profile & time',{exact:true}).click();await page.getByRole('dialog',{name:'An hour of possibilities'}).waitFor();
 const names=['An hour of possibilities','Quietly finding meaning','The grand coding voyage','Eight hours, many questions','Twenty hours of perspective','Reading between the lines','A hundred hours of persistence','Five days of showing up','A steady training arc','A year in motion','Three growing studies','Five projects, one researcher','The delivery route','A universe of stories'];
 for(let i=0;i<names.length;i++){await page.getByRole('dialog',{name:names[i],exact:true}).waitFor();await page.getByRole('button',{name:i===names.length-1?'Close':'Next celebration',exact:true}).click();}
 assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('eqc-profiles-v2')).profiles[0].milestones.filter(a=>a.seenAt).length),15);
 fs.mkdirSync('release/milestone-qa',{recursive:true});await page.locator('.milestone-collection').screenshot({path:'release/milestone-qa/Collection.png'});
 await page.getByRole('button',{name:'Replay The grand coding voyage'}).click();await page.getByRole('dialog',{name:'The grand coding voyage'}).waitFor();await page.getByRole('dialog').screenshot({path:'release/milestone-qa/Luffy.png'});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Replay A little spark'}).click();await page.clock.runFor(10001);assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'New profile',exact:true}).click();assert.equal(await page.locator('.milestone-collection').count(),0);await page.getByLabel('Active profile',{exact:true}).selectOption('milestone-profile');await page.waitForFunction(()=>document.querySelectorAll('.milestone-badge').length===15);assert.equal(await page.locator('.milestone-badge').count(),15);assert.equal(await page.getByRole('dialog').count(),0);
 await page.reload();await page.clock.runFor(3500);await page.getByTitle('Profile & time',{exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.milestone-badge').length===15);assert.equal(await page.locator('.milestone-badge').count(),15);assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Back to Workspace'}).click();await page.locator('.workspace-sources .doc-row').first().click();
 const readingMenu=page.locator('.tool-menu').filter({has:page.locator('summary',{hasText:/^Reading$/})});
 for(let opening=0;opening<8;opening++){
  await page.getByText('Reading',{exact:true}).click();
  await page.waitForFunction(()=>{const menu=[...document.querySelectorAll('.tool-menu')].find(el=>el.querySelector('summary')?.textContent==='Reading');return menu?.open&&menu.querySelector('.tool-menu-content').style.maxHeight;});
  assert.equal(await readingMenu.locator('.tool-menu-content').evaluate(el=>el.scrollHeight>el.clientHeight+1),false,'Reading controls fit on every opening');
  const panel=await readingMenu.locator('.tool-menu-content').boundingBox(),size=await page.getByRole('spinbutton',{name:'Reading font size',exact:true}).boundingBox();assert.ok(size.y+size.height<=panel.y+panel.height,'Size field fully visible');
  await page.keyboard.press('Escape');
 }
 await page.getByText('Reading',{exact:true}).click();assert.equal(await page.getByLabel('Coding stripes',{exact:true}).count(),0);await page.getByRole('button',{name:'Add font…',exact:true}).click();assert.equal(await readingMenu.locator('.tool-menu-content').evaluate(el=>el.scrollHeight>el.clientHeight+1),false,'Expanded font form fits available space');await page.getByLabel('Installed font name').fill('Aptos');await page.getByRole('button',{name:'Use font',exact:true}).click();assert.equal(await page.getByLabel('Reading font',{exact:true}).inputValue(),'"Aptos", sans-serif');assert.equal(await page.locator('.doc-editor').evaluate(el=>getComputedStyle(el).fontFamily),'Aptos, sans-serif');
 const fontSize=page.getByRole('spinbutton',{name:'Reading font size',exact:true});
 await fontSize.fill('28');assert.equal(await page.locator('.doc-editor').evaluate(el=>getComputedStyle(el).fontSize),'28px');
 const controls=await Promise.all([page.getByTitle('Decrease font size',{exact:true}),fontSize,page.getByTitle('Increase font size',{exact:true})].map(el=>el.boundingBox()));assert.ok(Math.max(...controls.map(b=>b.y+b.height/2))-Math.min(...controls.map(b=>b.y+b.height/2))<2,'Font controls share one row');
 await fontSize.fill('');await fontSize.pressSequentially('24');assert.equal(await fontSize.inputValue(),'24');assert.equal(await page.locator('.doc-editor').evaluate(el=>getComputedStyle(el).fontSize),'24px');
 await fontSize.fill('99');await fontSize.blur();assert.equal(await fontSize.inputValue(),'48');
 await fontSize.fill('0');await fontSize.press('Enter');assert.equal(await fontSize.inputValue(),'8');
 await fontSize.fill('');await fontSize.blur();assert.equal(await fontSize.inputValue(),'8');
 await page.getByTitle('Increase font size',{exact:true}).click();assert.equal(await fontSize.inputValue(),'9');await page.getByTitle('Decrease font size',{exact:true}).click();assert.equal(await fontSize.inputValue(),'8');
 await fontSize.fill('26');await fontSize.press('Enter');assert.equal(await page.evaluate(()=>localStorage.getItem('qda-reader-font-size')),'26');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Codes & Strips',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Codes & Strips',exact:true}).getAttribute('aria-pressed'),'true');
 await page.reload();await page.clock.runFor(3500);await page.getByText('Reading',{exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Reading font size',exact:true}).inputValue(),'26');assert.equal(await page.getByLabel('Reading font',{exact:true}).inputValue(),'"Aptos", sans-serif');await page.getByRole('button',{name:'Remove font',exact:true}).click();assert.equal(await page.getByLabel('Reading font',{exact:true}).inputValue(),'');await page.keyboard.press('Escape');
 await page.getByTitle('Profile & time',{exact:true}).click();for(const width of [800,640]){await page.setViewportSize({width,height:768});assert.equal(await page.locator('.profile-panel').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await page.getByRole('button',{name:'Replay A little spark'}).click();assert.ok((await page.getByRole('dialog').boundingBox()).width<=width-30);await page.keyboard.press('Escape');}
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Replay A little spark'}).click();assert.equal(await page.locator('.milestone-art-animated .milestone-character').evaluate(el=>getComputedStyle(el).animationName),'none');await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
 console.log('Milestones: all 15 awards, sequential/automatic replay, defer/reopen, seen persistence, profile isolation, responsive/reduced motion, Workspace-only stripes and preferred fonts passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
