const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const binary = /\.(png|jpe?g|gif|webp|bmp|docx|pdf)$/i;

async function readExchangeFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  const payload = { fileName: path.basename(filePath), qdeXml: '', sourceFiles: {}, sourceBytes: {} };
  if (extension === '.qdc') { payload.qdeXml = buffer.toString('utf8'); return payload; }
  if (extension === '.qde') {
    payload.qdeXml = buffer.toString('utf8');
    const root = fs.realpathSync(path.dirname(filePath));
    // An extracted QDE may reference the adjacent sources folder. Never follow links outside it.
    const sourceFolder = fs.readdirSync(root, { withFileTypes: true }).find(entry => entry.isDirectory() && entry.name.toLowerCase() === 'sources');
    if (sourceFolder) {
      const walk = directory => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const full = path.join(directory, entry.name);
        const resolved = fs.realpathSync(full);
        if (!resolved.startsWith(root + path.sep)) continue;
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile()) { const relative = path.relative(root, full).split(path.sep).join('/'); const bytes = fs.readFileSync(full); if (binary.test(relative)) payload.sourceBytes[relative] = bytes.toString('base64'); else payload.sourceFiles[relative] = bytes.toString('utf8'); }
      } };
      walk(path.join(root, sourceFolder.name));
    }
    return payload;
  }
  if (extension !== '.qdpx') throw new Error('Choose a QDPX project, QDC codebook or extracted QDE project.');
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  const qde = entries.find(entry => !entry.dir && /\.qde$/i.test(entry.name));
  if (!qde) throw new Error('No project.qde file found inside this QDPX archive.');
  payload.qdeXml = await qde.async('string');
  for (const entry of entries.filter(entry => !entry.dir && /(^|\/)sources\//i.test(entry.name))) {
    if (binary.test(entry.name)) payload.sourceBytes[entry.name] = await entry.async('base64');
    else payload.sourceFiles[entry.name] = await entry.async('string');
  }
  return payload;
}
module.exports = { readExchangeFile };
