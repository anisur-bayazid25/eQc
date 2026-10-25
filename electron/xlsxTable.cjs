// Reads a workbook's cell grid without a spreadsheet dependency: an .xlsx file
// is a ZIP of XML parts, and a codebook table only needs the values, not
// styles, formulas or formatting. Returns every sheet as a plain string grid so
// the renderer can offer sheet selection and column mapping.
const JSZip = require('jszip');

function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (match, entity) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    const code = entity[0] === '#'
      ? (entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10))
      : NaN;
    return Number.isFinite(code) ? String.fromCodePoint(code) : match;
  });
}

// Concatenates every <t> run inside an <si>/<is> element (rich text splits a
// single string across runs).
function richText(xml) {
  let out = '';
  for (const match of String(xml).matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decodeEntities(match[1]);
  return out;
}

// "AB12" -> 27 (zero-based column index)
function columnIndex(reference) {
  const letters = /^([A-Z]+)/.exec(String(reference || ''))?.[1];
  if (!letters) return -1;
  let index = 0;
  for (const character of letters) index = index * 26 + (character.charCodeAt(0) - 64);
  return index - 1;
}

async function readSheetNames(zip) {
  const file = zip.file('xl/workbook.xml');
  if (!file) return [];
  const xml = await file.async('string');
  const names = [];
  for (const match of xml.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)) names.push(decodeEntities(match[1]));
  return names;
}

async function readSharedStrings(zip) {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return [];
  const xml = await file.async('string');
  const values = [];
  for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) values.push(richText(match[1]));
  return values;
}

async function readSheetRows(xml, shared) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1] || '';
      const body = cellMatch[2] || '';
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      let value = '';
      if (type === 'inlineStr') {
        value = richText(body);
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (raw !== undefined) value = type === 's' ? (shared[Number(raw)] ?? '') : decodeEntities(raw);
      }
      const index = reference ? columnIndex(reference) : cells.length;
      if (index >= 0) cells[index] = value;
    }
    rows.push(Array.from(cells, cell => (cell === undefined ? '' : String(cell))));
  }
  // Drop trailing blank rows so a padded sheet does not look like data.
  while (rows.length && rows[rows.length - 1].every(value => !value.trim())) rows.pop();
  return rows;
}

/**
 * @param {Buffer|Uint8Array} buffer
 * @returns {Promise<Array<{name:string, rows:string[][]}>>}
 */
async function readWorkbook(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const shared = await readSharedStrings(zip);
  const names = await readSheetNames(zip);
  const sheetFiles = Object.keys(zip.files)
    .filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  const sheets = [];
  for (let i = 0; i < sheetFiles.length; i++) {
    const xml = await zip.file(sheetFiles[i]).async('string');
    const rows = await readSheetRows(xml, shared);
    if (!rows.length) continue;
    sheets.push({ name: names[i] || `Sheet ${i + 1}`, rows });
  }
  return sheets;
}

module.exports = { readWorkbook };
