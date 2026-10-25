import { Project, Code, SourceDoc, CodedSegment, uid, colorForNewCode } from '../domain';
import type { CsvParseResult } from '../global';

export interface CsvImportSummary {
  docsCreated: number;
  docsAppended: number;
  codesCreated: number;
  segmentsCreated: number;
  segmentsNotFound: number;
  // Definition cells that arrived for a code that already had one. First
  // non-empty definition wins (an existing coding rule is never silently
  // overwritten), so these are reported to the user rather than dropped.
  definitionsSkipped: number;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function findOrCreateCode(project: Project, name: string, parentId: string | null): Code {
  const trimmed = name.trim();
  const existing = project.codes.find(
    c => c.parentId === parentId && normalize(c.name) === normalize(trimmed)
  );
  if (existing) return existing;
  const created: Code = {
    id: uid('code'),
    name: trimmed,
    color: colorForNewCode(project.codes, parentId, project.codes.length),
    parentId,
    summary: '',
    createdAt: Date.now()
  };
  project.codes.push(created);
  return created;
}

function findOrCreateDoc(project: Project, name: string): { doc: SourceDoc; created: boolean } {
  const trimmed = name.trim() || 'Untitled source';
  const existing = project.docs.find(d => normalize(d.name) === normalize(trimmed));
  if (existing) return { doc: existing, created: false };
  const doc: SourceDoc = {
    id: uid('doc'),
    folderId: null,
    name: trimmed,
    content: '',
    addedAt: Date.now(),
    sizeBytes: 0
  };
  project.docs.push(doc);
  return { doc, created: true };
}

function appendSummary(code: Code, text: string) {
  const clean = text.trim();
  if (!clean) return;
  if (code.summary.includes(clean)) return;
  code.summary = code.summary ? `${code.summary}\n\n${clean}` : clean;
}

// Code depth is arbitrary in eQc, so the importer works from a path of levels
// rather than a fixed parent/child1/child2 triple. Header-based routing is kept
// for older callers that only pass `summaryFields`; the import dialog passes
// explicit `{ field, level }` entries instead.
function levelForHeader(fieldName: string): number | 'leaf' {
  const n = normalize(fieldName);
  // "Level 2" counts levels from one, so it is the second code level (index 1);
  // "Child 2" already names the second child (index 2). Keep the two rules
  // separate — collapsing them shifted summary/definition columns one level up.
  const levelWord = /level[\s_-]*(\d+)/.exec(n);
  if (levelWord) return Math.max(0, Number(levelWord[1]) - 1);
  const childWord = /(?:child|sub[\s_-]?code|code|node)[\s_-]*(?:code|node)?[\s_-]*(\d+)/.exec(n);
  if (childWord) return Math.max(1, Number(childWord[1]));
  if (/\bparent\b|\btheme\b|\bcategory\b|\bdomain\b/.test(n)) return 0;
  return 'leaf';
}

function pathTarget(path: Array<Code | null>, fieldName: string): Code | null {
  const level = levelForHeader(fieldName);
  if (level === 'leaf') return deepestCode(path);
  return path[level] || null;
}

function deepestCode(path: Array<Code | null>): Code | null {
  for (let i = path.length - 1; i >= 0; i--) if (path[i]) return path[i];
  return null;
}


// Same level-routing as summaries, but a definition is a single codebook
// rule rather than an accreting memo: first non-empty value wins, later
// rows leave an existing definition untouched. Returns false when an incoming
// definition was skipped, so the import can disclose it instead of dropping it.
function applyDefinition(code: Code, text: string): boolean {
  const clean = text.trim();
  if (!clean) return true;
  if (code.definition && code.definition.trim()) return false;
  code.definition = clean;
  return true;
}

// Mirrors the manual-coding limitation already noted for this app: the
// first occurrence of the quote text in the document is used. Improve to
// track exact positions if the same quote occurs more than once.
function locateQuote(content: string, quote: string): { start: number; end: number } | null {
  const idx = content.indexOf(quote);
  if (idx === -1) return null;
  return { start: idx, end: idx + quote.length };
}

export function importCsvDataset(project: Project, csv: CsvParseResult): CsvImportSummary {
  const summary: CsvImportSummary = {
    docsCreated: 0,
    docsAppended: 0,
    codesCreated: 0,
    segmentsCreated: 0,
    segmentsNotFound: 0,
    definitionsSkipped: 0
  };

  // Level columns in order. `levels` (from the import dialog) supports any
  // depth; the fixed parent/child1/child2 triple remains for older callers.
  const legacyLevels = [csv.columns.parent, csv.columns.child1, csv.columns.child2];
  const rawLevels = csv.columns.levels && csv.columns.levels.length ? csv.columns.levels.slice() : legacyLevels;
  // Drop trailing empty levels, but keep a gap in the middle: it means "this
  // level has no column", and deeper codes attach to the nearest ancestor.
  while (rawLevels.length && !rawLevels[rawLevels.length - 1]) rawLevels.pop();
  const levelColumns: Array<string | null> = rawLevels;

  const hasSourceAndQuote = !!(csv.columns.source && csv.columns.quote);
  const hasAnyCodeColumn = levelColumns.some(Boolean);

  if (!hasSourceAndQuote && !hasAnyCodeColumn) {
    throw new Error(
      'CSV needs either a Document/Source + Quote/Excerpt pair (to import coded excerpts), or at least one code column (to import a codebook only).'
    );
  }

  const codesBefore = project.codes.length;
  // Documents created by this import run (their content is built from quotes).
  // A document that already existed is never modified.
  const createdDocIds = new Set<string>();

  for (const row of csv.rows) {
    // Build this row's code path, one entry per level. An empty cell leaves the
    // level null and deeper codes attach to the nearest ancestor that exists.
    const path: Array<Code | null> = [];
    let parentId: string | null = null;
    for (const column of levelColumns) {
      const name = column ? String(row[column] || '').trim() : '';
      if (!name) {
        path.push(null);
        continue;
      }
      const code = findOrCreateCode(project, name, parentId);
      path.push(code);
      parentId = code.id;
    }
    const leafCode = deepestCode(path);

    // Per-level summary and definition columns win; they are explicit, so a
    // five-level codebook can give every level its own summary and rule.
    for (const binding of csv.summaryColumns || []) {
      const text = row[binding.field];
      if (!text || !text.trim()) continue;
      const target = path[binding.level] || null;
      if (target) appendSummary(target, text);
    }
    for (const binding of csv.definitionColumns || []) {
      const text = row[binding.field];
      if (!text || !text.trim()) continue;
      const target = path[binding.level] || null;
      if (target && !applyDefinition(target, text)) summary.definitionsSkipped++;
    }

    // Header-routed columns (older callers, and files whose column names say
    // which level they describe, e.g. "Summary of Child 1").
    for (const field of csv.summaryFields) {
      const text = row[field];
      if (!text || !text.trim() || !leafCode) continue;
      const target = pathTarget(path, field);
      if (target) appendSummary(target, text);
    }

    // Coding definitions ride the same codebook-only path as summaries, so
    // a codes + definition-columns CSV populates code definitions. A definition
    // that loses to an existing one is counted, never silently discarded.
    for (const field of csv.definitionFields || []) {
      const text = row[field];
      if (!text || !text.trim() || !leafCode) continue;
      const target = pathTarget(path, field);
      if (target && !applyDefinition(target, text)) summary.definitionsSkipped++;
    }

    // Keep structured codebook guidance in the leaf memo with its labels.
    if (leafCode) {
      for (const field of csv.metadataFields || []) {
        const text = row[field]?.trim();
        if (text) appendSummary(leafCode, `${field}: ${text}`);
      }
    }

    // Everything below only runs if the file actually has source/quote
    // columns at all — a codebook-only import stops here, every row,
    // which is exactly the intended behavior.
    if (!hasSourceAndQuote) continue;

    const sourceName = row[csv.columns.source!] || '';
    const quote = row[csv.columns.quote!] || '';
    if (!sourceName.trim() || !quote.trim()) continue;

    const coderName = csv.columns.coder ? String(row[csv.columns.coder] || '').trim() : '';

    const { doc, created } = findOrCreateDoc(project, sourceName);
    if (created) {
      summary.docsCreated++;
      // Remember which documents this import created: only those may be
      // extended with further quotes. An existing transcript is never
      // rewritten, which previously appended unmatched (typo'd or paraphrased)
      // quotes onto the user's real source text.
      createdDocIds.add(doc.id);
      doc.content = quote;
      doc.sizeBytes = doc.content.length;
    } else if (createdDocIds.has(doc.id) && !doc.content.includes(quote)) {
      doc.content = doc.content ? `${doc.content}\n\n${quote}` : quote;
      doc.sizeBytes = doc.content.length;
      summary.docsAppended++;
    }

    const targetCode = leafCode;
    if (!targetCode) continue;

    const loc = locateQuote(doc.content, quote);
    if (!loc) {
      summary.segmentsNotFound++;
      continue;
    }

    const alreadyCoded = project.codedSegments.some(
      s => s.docId === doc.id && s.codeId === targetCode.id && s.start === loc.start && s.end === loc.end &&
        (s.coder || '') === coderName
    );
    if (!alreadyCoded) {
      const segment: CodedSegment = {
        id: uid('seg'),
        docId: doc.id,
        codeId: targetCode.id,
        start: loc.start,
        end: loc.end,
        text: quote,
        createdAt: Date.now(),
        source: 'csv-import',
        ...(coderName ? { coder: coderName } : {})
      };
      project.codedSegments.push(segment);
      summary.segmentsCreated++;
    }
  }

  summary.codesCreated = project.codes.length - codesBefore;
  return summary;
}
