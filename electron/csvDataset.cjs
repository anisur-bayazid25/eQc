const Papa = require('papaparse');

const HEADER_MAP = {
  source: ['participant', 'document', 'source'],
  quote: ['quote', 'quotes', 'excerpt', 'text'],
  parent: ['parent node', 'parent', 'parent code'],
  child1: ['child node 1', 'child 1', 'child code', 'child code 1'],
  child2: ['child node 2', 'child 2', 'child code 2']
};
const normalizeHeader = h => String(h || '').trim().toLowerCase();

function parseCsvDataset(raw, fileName) {
  // Prose-heavy tab tables can fool delimiter detection with commas in cells.
  // Prefer tabs when the header contains them; otherwise let Papa detect CSV.
  const header = raw.split(/\r?\n/, 1)[0];
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: 'greedy',
    ...(header.includes('\t') && !header.startsWith('"') ? { delimiter: '\t' } : {}) });
  const fields = (parsed.meta.fields || []).map(raw => ({ raw, norm: normalizeHeader(raw) }));
  const findField = keys => fields.find(f => keys.includes(f.norm))?.raw || null;
  return {
    fileName,
    fields: fields.map(f => f.raw),
    columns: Object.fromEntries(Object.entries(HEADER_MAP).map(([role, keys]) => [role, findField(keys)])),
    summaryFields: fields.filter(f => f.norm.startsWith('summary of') || f.norm.endsWith('summary')).map(f => f.raw),
    definitionFields: fields.filter(f => f.norm.startsWith('definition of') || f.norm.endsWith('definition')).map(f => f.raw),
    metadataFields: fields.filter(f => ['include when', 'exclusion / coding note', 'study objective', 'relevant data sources'].includes(f.norm)).map(f => f.raw),
    rows: parsed.data,
    errors: parsed.errors
  };
}

// Spreadsheet rows arrive as a plain grid. The first row is the header; blank
// rows are dropped and repeated header names are made unique so no column is
// silently shadowed by another.
function gridToTable(rows) {
  const used = new Set();
  const fields = (rows[0] || []).map((header, index) => {
    const base = String(header == null || header === '' ? '' : header).trim() || `Column ${index + 1}`;
    let name = base;
    let suffix = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${suffix++})`;
    used.add(name.toLowerCase());
    return name;
  });
  const objects = [];
  for (const row of rows.slice(1)) {
    const object = {};
    let empty = true;
    fields.forEach((field, index) => {
      const value = row[index] == null ? '' : String(row[index]);
      object[field] = value;
      if (value.trim()) empty = false;
    });
    if (!empty) objects.push(object);
  }
  return { fields, rows: objects };
}

module.exports = { parseCsvDataset, gridToTable };
