const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const { verifyMacPackage } = require('../.github/scripts/verify-mac-package.cjs');
const { mergeMacUpdates } = require('../.github/scripts/merge-mac-updates.cjs');

function fixture(t, arch = 'x64') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eqc-mac-package-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'eQc.app', 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release');
  fs.mkdirSync(directory, { recursive: true });
  const native = path.join(directory, 'better_sqlite3.node');
  fs.writeFileSync(native, 'fixture');
  return { root, native, context: { electronPlatformName: 'darwin', arch, appOutDir: root, packager: { appInfo: { productFilename: 'eQc' } } } };
}
const log = () => {};

test('rejects the reported Intel installer with an ARM SQLite binary before startup', async t => {
  const f = fixture(t); let launched = false;
  await assert.rejects(verifyMacPackage(f.context, { hostArch: 'x64', log, run: (command, args) => {
    if (command !== '/usr/bin/lipo') { launched = true; return ''; }
    return args[1] === f.native ? 'arm64\n' : 'x86_64\n';
  } }), /Wrong architecture.*expected x86_64, found arm64/);
  assert.equal(launched, false);
});
for (const arch of ['x64', 'arm64']) {
  test(`validates Mac ${arch} binaries and launches packaged SQLite in memory`, async t => {
    const f = fixture(t, arch), calls = [];
    await verifyMacPackage(f.context, { hostArch: arch, log, run: (command, args, options) => {
      calls.push({ command, args, options });
      return command === '/usr/bin/lipo' ? (arch === 'x64' ? 'x86_64' : 'arm64') : 'EQC_NATIVE_SMOKE_OK\n';
    } });
    assert.equal(calls.length, 3);
    const smoke = calls[2];
    assert.equal(smoke.options.env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal(smoke.options.timeout, 30000);
    assert.match(smoke.args[1], /app\.asar/);
    assert.match(smoke.args[1], /new Database\(':memory:'\)/);
    assert.match(smoke.args[1], /SELECT 1 AS ok/);
    assert.match(smoke.command, /Contents[\\/]MacOS[\\/]eQc$/);
  });
}
test('a native loader failure stops packaging', async t => {
  const f = fixture(t);
  await assert.rejects(verifyMacPackage(f.context, { hostArch: 'x64', log, run: command => {
    if (command === '/usr/bin/lipo') return 'x86_64';
    throw new Error('dlopen incompatible architecture');
  } }), /dlopen incompatible architecture/);
});
test('missing SQLite and incomplete smoke checks stop packaging', async t => {
  const f = fixture(t);
  await assert.rejects(verifyMacPackage(f.context, { hostArch: 'x64', log, run: command => command === '/usr/bin/lipo' ? 'x86_64' : '' }), /did not complete/);
  fs.unlinkSync(f.native);
  await assert.rejects(verifyMacPackage(f.context, { log }), /component is missing/);
});
test('cross-compilation still checks every binary, but does not run the wrong architecture', async t => {
  const f = fixture(t, 1); let count = 0;
  await verifyMacPackage(f.context, { hostArch: 'arm64', log, run: command => {
    assert.equal(command, '/usr/bin/lipo'); count++; return 'x86_64 arm64';
  } });
  assert.equal(count, 2);
});
test('Windows and Linux packaging do not invoke Mac tools', async () => {
  for (const electronPlatformName of ['win32', 'linux']) {
    await verifyMacPackage({ electronPlatformName }, { run: () => assert.fail('Mac tool called') });
  }
});

function manifests(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eqc-mac-updates-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const version = '1.8.7', items = [];
  for (const arch of ['x64', 'arm64']) {
    const dir = path.join(root, arch); fs.mkdirSync(dir);
    const url = `eQc-Setup-${version}-${arch}.dmg`, content = Buffer.from(`disk-image-${arch}`);
    const sha512 = crypto.createHash('sha512').update(content).digest('base64');
    fs.writeFileSync(path.join(dir, url), content);
    const file = path.join(dir, `latest-mac-${arch}.yml`);
    const data = { version, files: [{ url, sha512, size: content.length }], path: url, sha512, releaseDate: '2026-10-19T00:00:00.000Z' };
    fs.writeFileSync(file, yaml.dump(data)); items.push({ file, data });
  }
  return { root, version, items };
}
test('merges verified Intel and Apple Silicon updates into one public manifest', async t => {
  const f = manifests(t);
  const output = await mergeMacUpdates(f.root, f.version);
  const combined = yaml.load(fs.readFileSync(output, 'utf8'));
  assert.deepEqual(combined.files, f.items.flatMap(item => item.data.files));
  assert.equal(combined.path, combined.files[0].url);
  assert.equal(combined.sha512, combined.files[0].sha512);
  assert.equal(combined.version, f.version);
  for (const item of f.items) assert.equal(fs.existsSync(item.file), false);
});
for (const corruption of ['checksum', 'size', 'version', 'filename']) {
  test(`rejects ${corruption} mismatch without deleting either input manifest`, async t => {
    const f = manifests(t), item = f.items[1];
    if (corruption === 'checksum') item.data.files[0].sha512 = 'incorrect';
    if (corruption === 'size') item.data.files[0].size++;
    if (corruption === 'version') item.data.version = '1.8.6';
    if (corruption === 'filename') item.data.files[0].url = '../other.dmg';
    fs.writeFileSync(item.file, yaml.dump(item.data));
    await assert.rejects(mergeMacUpdates(f.root, f.version), /differs|Unexpected/);
    for (const input of f.items) assert.equal(fs.existsSync(input.file), true);
    assert.equal(fs.existsSync(path.join(f.root, 'mac-update', 'latest-mac.yml')), false);
  });
}
test('missing or duplicate architecture manifests block publication', async t => {
  const f = manifests(t);
  const second = path.join(f.root, 'arm64', 'latest-mac-x64.yml');
  fs.renameSync(f.items[1].file, second);
  await assert.rejects(mergeMacUpdates(f.root, f.version), /Missing or duplicate/);
  fs.unlinkSync(second);
  await assert.rejects(mergeMacUpdates(f.root, f.version), /exactly two/);
});
test('release builds use separate native Mac runners, explicit targets and packaged checks', () => {
  const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../.github/workflows/build.yml'), 'utf8'));
  const matrix = workflow.jobs.build.strategy.matrix.include.filter(item => item.platform === 'mac');
  assert.deepEqual(matrix, [{ os: 'macos-15-intel', platform: 'mac', arch: 'x64' }, { os: 'macos-latest', platform: 'mac', arch: 'arm64' }]);
  const steps = workflow.jobs.build.steps;
  assert.ok(steps.some(step => step.run?.includes('electron-builder --${{ matrix.platform }} --${{ matrix.arch }}')));
  assert.ok(steps.some(step => step.run?.includes('latest-mac-${{ matrix.arch }}.yml')));
  assert.equal(require('../package.json').build.afterPack, '.github/scripts/verify-mac-package.cjs');
  const release = workflow.jobs.release.steps;
  assert.ok(release.findIndex(step => step.run?.includes('merge-mac-updates.cjs')) < release.findIndex(step => step.uses?.startsWith('softprops/action-gh-release')));
});
