const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');

(async () => {
  const convert = require('heic-convert');
  const png = Buffer.from(await convert({ buffer: fs.readFileSync(workerData.filePath), format: 'PNG' }));
  parentPort.postMessage({ base64: png.toString('base64'), sizeBytes: png.length });
})().catch(error => parentPort.postMessage({ error: error.message || String(error) }));
