const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
const { buildStarredQuotesExport } = require('../src/lib/starredQuotes.ts');
const quote = { id:'s', docId:'d', codeId:'c', start:0, end:5, text:'Hello', starred:true, coder:'Ann', note:'Private note', createdAt:1 };
const project = { id:'p', name:'Example', codes:[{id:'parent',name:'Experiences',parentId:null},{id:'c',name:'Recovery',parentId:'parent',summary:'Private summary'},{id:'other',name:'Support',parentId:null}], docs:[{id:'d',name:'Interview.txt'}], codedSegments:[quote,{...quote,id:'duplicate',coder:'Bob'},{...quote,id:'unstarred',starred:false,text:'Other'},{...quote,id:'othercode',codeId:'other'}], codedRegions:[{id:'r',codeId:'c',imageId:'image',starred:true}], cases:[{id:'person',name:'Mere',attributes:{Age:'39',Gender:'Woman',Occupation:'Fish seller',Area:'Coastal village',Country:'Fiji',Custom:'All details'},links:[{docId:'d',start:0,end:5}]},{id:'unrelated',name:'Other person',attributes:{Private:'Unrelated details'},links:[{docId:'d',start:10,end:20}]}] };
test('manuscript quotes exclude other content and duplicate coder assignments; selection keeps code paths', () => {
  const before = JSON.stringify(project);
  const {count,payload} = buildStarredQuotesExport(project,'manuscript',new Set(['c']));
  assert.equal(count,1); assert.equal(payload.manuscript,true);
  assert.equal(payload.outline[0].name,'Experiences > Recovery');
  assert.deepEqual(payload.outline[0].attributedQuotes,[{text:'Hello',attribution:'39 year old female fish seller [Mere] from a coastal village in Fiji'}]);
  assert.doesNotMatch(JSON.stringify(payload),/Private|Custom|Interview|Ann|Bob|image|Support/);
  assert.equal(JSON.stringify(project),before);
});
test('detailed quotes include document, code and all attributes of relevant cases only', () => {
  const {count,payload} = buildStarredQuotesExport(project,'details');
  assert.equal(count,2);
  const attribution=payload.outline[0].attributedQuotes[0].attribution;
  assert.match(attribution,/Document: Interview.txt/);assert.match(attribution,/Cases: Mere/);
  for(const [key,value] of Object.entries(project.cases[0].attributes)) assert.ok(attribution.includes(`${key}=${value}`));
  assert.doesNotMatch(JSON.stringify(payload),/Other person|Unrelated details|Private summary|Private note|imageQuotes/);
});
test('empty selection and image-only projects produce no text quotes; missing cases fall back to source', () => {
  assert.equal(buildStarredQuotesExport(project,'details',new Set()).count,0);
  assert.equal(buildStarredQuotesExport({...project,codedSegments:[]},'manuscript').count,0);
  assert.equal(buildStarredQuotesExport({...project,cases:[]},'manuscript').payload.outline[0].attributedQuotes[0].attribution,'Interview.txt');
});

test('actual Word exporter includes starred quotes and italic attribution in both downloads and manuscript skeleton', async () => {
  const vm = require('node:vm'), docx = require('docx'), JSZip = require('jszip');
  const main = fs.readFileSync(require('node:path').resolve(__dirname, '../electron/main.cjs'), 'utf8');
  const start = main.indexOf('function buildOutlineDocx('), end = main.indexOf('\nfunction buildImageGalleryDocx(', start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({...docx, Buffer, Math});
  vm.runInContext(main.slice(start, end), context);
  const manuscriptProject = {...project,codes:project.codes.map(c=>({...c,summary:c.summary||''}))};
  const skeleton = await require('../src/lib/manuscript.ts').buildManuscriptOutline(manuscriptProject,{framework:false,cooccurrence:false,projectMemos:false});
  const payloads = ['manuscript','details'].map(format=>buildStarredQuotesExport(project,format,new Set(['c'])).payload);
  payloads.push({title:'Results skeleton',outline:skeleton,manuscript:true});
  for (const payload of payloads) {
    const buffer = await docx.Packer.toBuffer(context.buildOutlineDocx(payload.title,payload.outline,payload.manuscript));
    const zip = await JSZip.loadAsync(buffer), xml = await zip.file('word/document.xml').async('string');
    assert.ok(xml.includes('“Hello”'),payload.title);
    assert.match(xml,/<w:i\/>/);
    assert.ok(xml.includes('Mere'),payload.title);
    if (payload.filenameBase?.includes('Source and case details')) {
      assert.ok(xml.includes('Custom=All details'));
      assert.ok(xml.includes('Document: Interview.txt'));
      assert.match(xml,/<w:br\/>/);
    } else assert.ok(xml.includes('39 year old female fish seller'));
  }
});
