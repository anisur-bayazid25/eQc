import { Project, Code, SourceDoc, CodedSegment, uid, randomColor } from '../domain';
import type { CsvParseResult } from '../global';

export interface CsvImportSummary {
  docsCreated: number;
  docsAppended: number;
  codesCreated: number;
  segmentsCreated: number;
  segmentsNotFound: number;
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
    color: randomColor(project.codes.length),
    parentId,
    summary: ''
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

function matchSummaryTarget(
  fieldName: string,
  parentCode: Code,
  child1Code: Code | null,
  child2Code: Code | null
): Code | null {
  const n = normalize(fieldName);
  if (n.includes('child 2') || n.includes('child node 2')) return child2Code;
  if (n.includes('child 1') || n.includes('child node 1')) return child1Code;
  if (n.includes('parent')) return parentCode;
  return parentCode; // generic "Summary" column defaults to the parent code
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
    segmentsNotFound: 0
  };

  if (!csv.columns.source || !csv.columns.quote) {
    throw new Error(
      'CSV is missing a required column. Include a Document/Participant/Source column and a Quote/Excerpt/Text column.'
    );
  }

  const codesBefore = project.codes.length;

  for (const row of csv.rows) {
    const sourceName = row[csv.columns.source] || '';
    const quote = row[csv.columns.quote] || '';
    if (!sourceName.trim() || !quote.trim()) continue;

    const { doc, created } = findOrCreateDoc(project, sourceName);
    if (created) {
      summary.docsCreated++;
      // Seed the new doc's content with its quotes so the excerpt can be
      // located and highlighted; further quotes are appended if new.
      doc.content = quote;
      doc.sizeBytes = doc.content.length;
    } else if (!doc.content.includes(quote)) {
      doc.content = doc.content ? `${doc.content}\n\n${quote}` : quote;
      doc.sizeBytes = doc.content.length;
      summary.docsAppended++;
    }

    const parentName = csv.columns.parent ? row[csv.columns.parent] : '';
    const child1Name = csv.columns.child1 ? row[csv.columns.child1] : '';
    const child2Name = csv.columns.child2 ? row[csv.columns.child2] : '';

    let parentCode: Code | null = null;
    let child1Code: Code | null = null;
    let child2Code: Code | null = null;

    if (parentName && parentName.trim()) {
      parentCode = findOrCreateCode(project, parentName, null);
    }
    if (child1Name && child1Name.trim()) {
      child1Code = findOrCreateCode(project, child1Name, parentCode ? parentCode.id : null);
    }
    if (child2Name && child2Name.trim()) {
      child2Code = findOrCreateCode(project, child2Name, child1Code ? child1Code.id : parentCode ? parentCode.id : null);
    }

    // Apply summaries to the correct level of the hierarchy.
    for (const field of csv.summaryFields) {
      const text = row[field];
      if (!text || !text.trim() || !parentCode) continue;
      const target = matchSummaryTarget(field, parentCode, child1Code, child2Code);
      if (target) appendSummary(target, text);
    }

    // The most specific code (child2 > child1 > parent) receives the coding.
    const targetCode = child2Code || child1Code || parentCode;
    if (!targetCode) continue;

    const loc = locateQuote(doc.content, quote);
    if (!loc) {
      summary.segmentsNotFound++;
      continue;
    }

    const alreadyCoded = project.codedSegments.some(
      s => s.docId === doc.id && s.codeId === targetCode.id && s.start === loc.start && s.end === loc.end
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
        source: 'csv-import'
      };
      project.codedSegments.push(segment);
      summary.segmentsCreated++;
    }
  }

  summary.codesCreated = project.codes.length - codesBefore;
  return summary;
}
