const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), ts = require('typescript');
const { PNG } = require('pngjs');
const { importImages, imageExtensions } = require('../electron/imageImport.cjs');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f);
const { helpSlug, helpSections } = require('../src/lib/helpSections.ts');

test('current Help books start at contents and every section link has a unique target', () => {
  for (const file of ['USER_GUIDE.md', 'DOCUMENTATION.md']) {
    const markdown = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const sections = helpSections(markdown);
    assert.equal(sections[0].title, 'Table of Contents');
    const targets = [...markdown.matchAll(/^#{2,6}\s+(.+)$/gm)].map(m => helpSlug(m[1]));
    assert.equal(new Set(targets).size, targets.length, `${file}: duplicate anchors`);
    for (const [, href] of markdown.matchAll(/\]\(#([^)]+)\)/g)) assert.ok(targets.includes(href), `${file}: broken #${href}`);
    assert.ok(!markdown.includes('Project tools → Research tools'));
  }
});
test('real HEIC photo converts to a decodable PNG, retaining its source name and source file', async () => {
  const file = path.join(__dirname, 'fixtures/heic/example.heic'), before = fs.readFileSync(file);
  const [photo] = await importImages([file]);
  assert.equal(photo.ok, true, photo.error); assert.equal(photo.name, 'example.heic');
  assert.ok(photo.dataUrl.startsWith('data:image/png;base64,'));
  const bytes = Buffer.from(photo.dataUrl.split(',')[1], 'base64'), png = PNG.sync.read(bytes);
  assert.equal(photo.sizeBytes, bytes.length); assert.ok(png.width > 100 && png.height > 100);
  assert.ok(png.data.some((value, i) => i % 4 !== 3 && value > 0));
  assert.deepEqual(fs.readFileSync(file), before);
});
test('HEIF extension, BMP and partial failures use the same batch import path', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eqc-image-test-'));
  try {
    const heif = path.join(directory, 'Phone.HEIF'), bad = path.join(directory, 'broken.heic'), bmp = path.join(directory, 'photo.bmp');
    fs.copyFileSync(path.join(__dirname, 'fixtures/heic/example.heic'), heif);
    fs.writeFileSync(bad, 'invalid photo'); fs.writeFileSync(bmp, Buffer.from('424d', 'hex'));
    const rows = await importImages([heif, bad, bmp]);
    assert.deepEqual(rows.map(r => r.ok), [true, false, true]);
    assert.equal(rows[0].name, 'Phone.HEIF'); assert.ok(rows[1].error); assert.equal(rows[1].dataUrl, '');
    assert.ok(rows[2].dataUrl.startsWith('data:image/bmp;base64,'));
    assert.ok(imageExtensions.includes('bmp') && imageExtensions.includes('heic') && imageExtensions.includes('heif'));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
