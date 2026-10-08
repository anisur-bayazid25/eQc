const { createHash } = require('node:crypto');

function captureOriginalSource(buffer, name, format, content) {
  if (format !== 'docx' && format !== 'pdf') return undefined;
  return { name, format, base64: buffer.toString('base64'), textHash: createHash('sha256').update(content, 'utf8').digest('hex') };
}

function decodeOriginalSource(original) {
  if (!original || !['docx', 'pdf'].includes(original.format) || typeof original.base64 !== 'string' || !original.base64) throw new Error('No supported original file is available.');
  const buffer = Buffer.from(original.base64, 'base64');
  if (!buffer.length) throw new Error('The retained original file is empty.');
  return buffer;
}

module.exports = { captureOriginalSource, decodeOriginalSource };
