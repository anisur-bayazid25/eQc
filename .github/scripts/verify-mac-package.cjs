'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function nativeFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...nativeFiles(file));
    else if (entry.isFile() && entry.name.endsWith('.node')) files.push(file);
  }
  return files;
}

async function verifyMacPackage(context, { run = execFileSync, hostArch = process.arch, log = console.log } = {}) {
  if (context.electronPlatformName !== 'darwin') return;
  const arch = typeof context.arch === 'string' ? context.arch : require('builder-util').Arch[context.arch];
  if (!['x64', 'arm64'].includes(arch)) throw new Error(`Unsupported Mac package architecture: ${arch}`);
  const name = context.packager.appInfo.productFilename;
  const contents = path.join(context.appOutDir, `${name}.app`, 'Contents');
  const executable = path.join(contents, 'MacOS', name);
  const resources = path.join(contents, 'Resources');
  const unpacked = path.join(resources, 'app.asar.unpacked');
  const native = nativeFiles(unpacked);
  if (!native.some(file => path.basename(file) === 'better_sqlite3.node')) {
    throw new Error('Packaged SQLite native component is missing.');
  }
  const expected = arch === 'x64' ? 'x86_64' : 'arm64';
  for (const file of [executable, ...native]) {
    const architectures = String(run('/usr/bin/lipo', ['-archs', file], { encoding: 'utf8' })).trim().split(/\s+/);
    if (!architectures.includes(expected)) {
      throw new Error(`Wrong architecture in ${file}: expected ${expected}, found ${architectures.join(', ')}. Refusing to package this installer.`);
    }
  }
  // Same-architecture CI jobs exercise the actual packaged Electron/SQLite pair,
  // entirely in memory: no project/profile files or application windows opened.
  if (hostArch === arch) {
    const sqlite = path.join(resources, 'app.asar', 'node_modules', 'better-sqlite3');
    const source = `const assert=require('node:assert/strict');assert.equal(process.arch,${JSON.stringify(arch)});const Database=require(${JSON.stringify(sqlite)});const db=new Database(':memory:');assert.equal(db.prepare('SELECT 1 AS ok').get().ok,1);db.close();console.log('EQC_NATIVE_SMOKE_OK');`;
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
    delete env.NODE_OPTIONS;
    const output = String(run(executable, ['-e', source], { env, encoding: 'utf8', timeout: 30000 }));
    if (!output.includes('EQC_NATIVE_SMOKE_OK')) throw new Error('Packaged Electron/SQLite startup check did not complete.');
  }
  log(`Verified Mac ${arch}: executable, ${native.length} native component(s)${hostArch === arch ? ', packaged SQLite startup' : ''}.`);
}

module.exports = verifyMacPackage;
module.exports.verifyMacPackage = verifyMacPackage;
