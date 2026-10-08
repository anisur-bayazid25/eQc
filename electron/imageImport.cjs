const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'heif'];
const mimeByExt = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
function convertHeic(filePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'imageImportWorker.cjs'), { workerData: { filePath } });
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true; clearTimeout(timer); void worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Photo conversion timed out. Try exporting the photo as JPEG or PNG.')), 120000);
    worker.once('message', result => finish(result.error ? new Error(result.error) : null, result));
    worker.once('error', error => finish(error));
    worker.once('exit', code => { if (!finished) finish(new Error(`Photo conversion stopped (${code}).`)); });
  });
}
async function importImages(paths) {
  const results = [];
  // Decode photos sequentially to avoid multiplying large image allocations.
  for (const filePath of paths || []) {
    const name = path.basename(filePath);
    try {
      const ext = path.extname(filePath).toLowerCase();
      if (!imageExtensions.includes(ext.slice(1))) throw new Error('Unsupported image format.');
      if (ext === '.heic' || ext === '.heif') {
        const png = await convertHeic(filePath);
        results.push({ name, dataUrl: `data:image/png;base64,${png.base64}`, sizeBytes: png.sizeBytes, ok: true });
      } else {
        const bytes = await fs.readFile(filePath);
        results.push({ name, dataUrl: `data:${mimeByExt[ext]};base64,${bytes.toString('base64')}`, sizeBytes: bytes.length, ok: true });
      }
    } catch (error) {
      results.push({ name, dataUrl: '', sizeBytes: 0, ok: false, error: error.message || String(error) });
    }
  }
  return results;
}
module.exports = { imageExtensions, importImages };
