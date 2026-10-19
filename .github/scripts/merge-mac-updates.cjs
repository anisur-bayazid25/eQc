'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');

function findManifests(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) findManifests(file, result);
    else if (entry.isFile() && /^latest-mac(?:-.*)?\.yml$/.test(entry.name)) result.push(file);
  }
  return result;
}
async function checksum(file) {
  const hash = crypto.createHash('sha512');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('base64');
}
async function mergeMacUpdates(root, version) {
  const manifests = findManifests(root);
  if (manifests.length !== 2) throw new Error('Expected exactly two architecture-specific Mac update manifests.');
  const inputs = [];
  for (const arch of ['x64', 'arm64']) {
    const matches = manifests.filter(file => path.basename(file) === `latest-mac-${arch}.yml`);
    if (matches.length !== 1) throw new Error(`Missing or duplicate Mac ${arch} update manifest.`);
    const manifest = matches[0];
    const data = yaml.load(fs.readFileSync(manifest, 'utf8'));
    const filename = `eQc-Setup-${version}-${arch}.dmg`;
    if (data?.version !== version || !Array.isArray(data.files) || data.files.length !== 1 || data.files[0].url !== filename) {
      throw new Error(`Unexpected version or file list in Mac ${arch} update manifest.`);
    }
    const file = data.files[0];
    const diskImage = path.join(path.dirname(manifest), filename);
    if (file.size !== fs.statSync(diskImage).size || file.sha512 !== await checksum(diskImage)) {
      throw new Error(`Mac ${arch} disk image size/checksum differs from its update metadata.`);
    }
    inputs.push({ manifest, data });
  }
  const files = inputs.flatMap(input => input.data.files);
  const combined = { ...inputs[0].data, files, path: files[0].url, sha512: files[0].sha512 };
  const directory = path.join(root, 'mac-update');
  fs.mkdirSync(directory, { recursive: true });
  const destination = path.join(directory, 'latest-mac.yml');
  fs.writeFileSync(destination, yaml.dump(combined, { lineWidth: -1 }));
  // Only the combined public manifest is uploaded, preventing same-name asset
  // overwrites and retaining update entries for both Intel and Apple Silicon.
  for (const input of inputs) fs.unlinkSync(input.manifest);
  return destination;
}

module.exports = { mergeMacUpdates };
if (require.main === module) {
  mergeMacUpdates(path.resolve(process.argv[2] || 'artifacts'), require('../../package.json').version)
    .then(file => console.log(`Verified and combined Mac update metadata: ${file}`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
