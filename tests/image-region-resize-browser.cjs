const { chromium } = require(process.env.EQC_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict'), path = require('node:path'), { spawn } = require('node:child_process');
const server = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5237', '--strictPort'], { stdio: 'ignore' });
(async () => { let browser; try {
  let ready = false;
  for (let i = 0; i < 150; i++) { if (server.exitCode !== null) throw Error('Preview stopped'); try { if ((await fetch('http://127.0.0.1:5237')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 100)); }
  assert.ok(ready, 'Preview ready');
  browser = await chromium.launch({ channel: process.env.EQC_BROWSER_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }), errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
  await page.route('**/__image-resize-test', route => route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
    const {default: React}=await import('/node_modules/.vite/deps/react.js');
    import ReactDOMClient from '/node_modules/.vite/deps/react-dom_client.js';
    const {createRoot}=ReactDOMClient;
    const {default:ImageEditor}=await import('/src/components/ImageEditor.tsx');
    import '/src/styles.css';
    const region={id:'r',imageId:'i',codeId:'c',x:.2,y:.2,width:.3,height:.3,coder:'Amina',starred:true,note:'Keep this memo',createdAt:123};
    const image={id:'i',name:'Test image',dataUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="lightgray"/></svg>')};
    function Test(){const [rows,setRows]=React.useState([region]),[editing,setEditing]=React.useState(null),[zoom,setZoom]=React.useState(1);
      window.__rows=rows;window.__edit=()=>setEditing('r');window.__zoom=setZoom;
      return React.createElement('div',{style:{width:600}},React.createElement(ImageEditor,{image,regions:rows,codesById:new Map([['c',{id:'c',name:'Livelihood',color:'#339966'}]]),pendingRegion:null,zoom,resizingRegionId:editing,onPendingRegionChange:r=>window.__pending=r,onClickRegions:()=>setEditing('r'),requestDeleteImage:()=>{},onFinishResize:()=>setEditing(null),onResizeRegion:(id,box)=>{window.__saves=(window.__saves||0)+1;setRows(rows.map(r=>r.id===id?{...r,...box}:r));}}));}
    createRoot(document.getElementById('root')).render(React.createElement(Test));
  </script>` }));
  await page.goto('http://127.0.0.1:5237/__image-resize-test');
  await page.locator('.coded-region').waitFor();
  async function edit() { await page.evaluate(() => window.__edit()); await page.getByRole('button', { name: 'Save region size', exact: true }).waitFor(); }
  async function drag(handle, dx, dy) {
    const b = await page.getByRole('button', { name: `Resize region ${handle}`, exact: true }).boundingBox();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:8});await page.mouse.up();
  }
  const original = await page.evaluate(() => window.__rows[0]);
  await edit(); await drag('se',60,45);
  assert.deepEqual(await page.evaluate(() => window.__rows[0]), original, 'Preview does not save');
  await page.getByRole('button',{name:'Save region size',exact:true}).click();
  let row=await page.evaluate(()=>window.__rows[0]);assert.ok(Math.abs(row.width-.4)<.005);assert.ok(Math.abs(row.height-.4)<.005);
  for(const key of ['id','codeId','imageId','coder','starred','note','createdAt'])assert.equal(row[key],original[key]);
  await edit();await drag('nw',-40,-30);await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(()=>window.__rows[0]),row,'Escape cancels');
  await edit();await drag('e',50,0);await page.getByRole('button',{name:'Cancel resize',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.__rows[0]),row,'Cancel discards');
  await page.evaluate(()=>window.__zoom(1.5));await edit();await drag('w',45,0);await page.getByRole('button',{name:'Save region size',exact:true}).click();
  row=await page.evaluate(()=>window.__rows[0]);assert.ok(Math.abs(row.x-.25)<.005,'Zoom-normalized coordinates: '+JSON.stringify(row));assert.ok(Math.abs(row.width-.35)<.005,'Zoom width: '+JSON.stringify(row));
  await edit();await drag('nw',-1000,-1000);await page.getByRole('button',{name:'Save region size',exact:true}).click();row=await page.evaluate(()=>window.__rows[0]);assert.equal(row.x,0);assert.equal(row.y,0);
  await edit();await drag('se',-1000,-1000);await page.getByRole('button',{name:'Save region size',exact:true}).click();row=await page.evaluate(()=>window.__rows[0]);assert.ok(row.width>=.009999 && row.height>=.009999,'Minimum size');
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>window.__pending),undefined,'Resizing never draws a new coding');
  console.log('Image region resizing: preview/save, metadata retention, cancel/Escape, zoom, image bounds and minimum size passed.');
} finally { if(browser) await browser.close();server.kill(); } })().catch(e=>{console.error(e);process.exitCode=1;});
