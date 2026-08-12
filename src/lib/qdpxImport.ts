import { Project, Code, SourceDoc, CodedSegment, ID, uid, colorForNewCode } from '../domain';

export interface QdpxParsePayload {
  fileName: string;
  qdeXml: string;
  sourceFiles: Record<string, string>; // zip path -> text content
}

export interface QdpxImportSummary {
  codesCreated: number;
  docsCreated: number;
  segmentsCreated: number;
  segmentsSkipped: number;
  memosImported: number;
  sourcesSkipped: string[]; // human-readable: "name (VideoSource)" / "name (TextSource, content not found)"
}

function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

// Mirrors csvImport.ts's locateQuote: first occurrence of the quote text
// in the document is used. Same known limitation — if the same excerpt
// occurs verbatim more than once, only the first match is used.
function locateQuote(content: string, quote: string): { start: number; end: number } | null {
  const idx = content.indexOf(quote);
  if (idx === -1) return null;
  return { start: idx, end: idx + quote.length };
}

// --- Tab-delimited detection & reformatting -------------------------------
// Some exporters flatten structured data (e.g. a video's comment thread)
// into a TextSource as a raw TSV dump. Left as-is it's an unreadable wall
// of text; reformatted into labeled row blocks it's actually usable. Only
// applied when creating a brand-new doc — existing docs are left untouched
// to avoid re-reformatting already-edited content on repeat imports.

const TAB_DELIM_MIN_COLUMNS = 3;

function looksTabDelimited(content: string): boolean {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return false;
  const headerCols = lines[0].split('\t').length;
  if (headerCols < TAB_DELIM_MIN_COLUMNS) return false;
  const matching = lines.filter(l => l.split('\t').length === headerCols).length;
  return matching / lines.length >= 0.8;
}

function reformatTabDelimited(content: string): string {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split('\t').map(h => h.trim() || 'Column');
  const rows = lines.slice(1);
  const blocks = rows.map((row, i) => {
    const cells = row.split('\t');
    const fields = headers.map((h, idx) => `${h}: ${(cells[idx] ?? '').trim()}`);
    return `— Row ${i + 1} —\n${fields.join('\n')}`;
  });
  return blocks.join('\n\n');
}

// --- GUID-aware dedupe helpers -------------------------------------------

function findOrCreateCode(
  project: Project,
  guidMap: Map<string, ID>,
  guid: string,
  name: string,
  color: string | null,
  parentId: ID | null
): Code {
  if (guidMap.has(guid)) {
    const existing = project.codes.find(c => c.id === guidMap.get(guid));
    if (existing) return existing;
  }
  const trimmed = name.trim() || 'Unnamed code';
  const existingByName = project.codes.find(
    c => c.parentId === parentId && normalize(c.name) === normalize(trimmed)
  );
  if (existingByName) {
    guidMap.set(guid, existingByName.id);
    return existingByName;
  }
  const created: Code = {
    id: uid('code'),
    name: trimmed,
    color: color || colorForNewCode(project.codes, parentId, project.codes.length),
    parentId,
    summary: '',
    createdAt: Date.now()
  };
  project.codes.push(created);
  guidMap.set(guid, created.id);
  return created;
}

function appendMemo(target: { summary?: string; notes?: string; note?: string }, field: 'summary' | 'notes' | 'note', text: string) {
  const clean = (text || '').trim();
  if (!clean) return;
  const current = (target as any)[field] || '';
  if (current.includes(clean)) return;
  (target as any)[field] = current ? `${current}\n\n${clean}` : clean;
}

// --- XML helpers -----------------------------------------------------------

function directChildren(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter(
    c => c.localName === localName || c.tagName === localName
  );
}

function directChild(el: Element, localName: string): Element | null {
  return directChildren(el, localName)[0] || null;
}

function textOf(el: Element | null): string {
  return el ? (el.textContent || '') : '';
}

// --- Notes resolution --------------------------------------------------

function buildNoteMap(doc: XMLDocument): Map<string, string> {
  const map = new Map<string, string>();
  const notesEl = doc.querySelector('Notes');
  if (!notesEl) return map;
  for (const note of directChildren(notesEl, 'Note')) {
    const guid = note.getAttribute('guid');
    if (!guid) continue;
    const content = directChild(note, 'PlainTextContent');
    const text = textOf(content) || note.getAttribute('name') || '';
    if (text.trim()) map.set(guid, text.trim());
  }
  return map;
}

function resolveMemoText(el: Element, noteMap: Map<string, string>): string {
  const parts: string[] = [];
  const desc = directChild(el, 'Description');
  if (desc && textOf(desc).trim()) parts.push(textOf(desc).trim());
  for (const ref of directChildren(el, 'NoteRef')) {
    const guid = ref.getAttribute('targetGUID');
    if (guid && noteMap.has(guid)) parts.push(noteMap.get(guid)!);
  }
  return parts.join('\n\n');
}

// --- Codebook ---------------------------------------------------------

function importCodeTree(
  project: Project,
  guidMap: Map<string, ID>,
  noteMap: Map<string, string>,
  el: Element,
  parentId: ID | null,
  summary: QdpxImportSummary
) {
  const guid = el.getAttribute('guid') || uid('guid');
  const name = el.getAttribute('name') || 'Unnamed code';
  const color = el.getAttribute('color');
  const codesBefore = project.codes.length;

  const code = findOrCreateCode(project, guidMap, guid, name, color, parentId);
  if (project.codes.length > codesBefore) summary.codesCreated++;

  const memo = resolveMemoText(el, noteMap);
  if (memo) {
    appendMemo(code, 'summary', memo);
    summary.memosImported++;
  }

  for (const child of directChildren(el, 'Code')) {
    importCodeTree(project, guidMap, noteMap, child, code.id, summary);
  }
}

function importCodebook(project: Project, doc: XMLDocument, guidMap: Map<string, ID>, noteMap: Map<string, string>, summary: QdpxImportSummary) {
  const codeBook = doc.querySelector('CodeBook');
  if (!codeBook) return;
  const codesRoot = directChild(codeBook, 'Codes');
  if (!codesRoot) return;
  for (const codeEl of directChildren(codesRoot, 'Code')) {
    importCodeTree(project, guidMap, noteMap, codeEl, null, summary);
  }
}

// --- Sources + coded selections -----------------------------------------

function resolveSourceText(el: Element, payload: QdpxParsePayload): string | null {
  const inline = directChild(el, 'PlainTextContent');
  if (inline && textOf(inline)) return textOf(inline);

  const path = el.getAttribute('plainTextPath');
  if (!path) return null;
  const cleaned = path.replace(/^internal:\/\//i, '').replace(/^\/+/, '');
  const match = Object.keys(payload.sourceFiles).find(k => k.endsWith(cleaned) || k === cleaned);
  return match ? payload.sourceFiles[match] : null;
}

function importSelection(
  project: Project,
  sel: Element,
  doc: SourceDoc,
  rawContent: string,
  guidMap: Map<string, ID>,
  noteMap: Map<string, string>,
  summary: QdpxImportSummary
) {
  const startAttr = sel.getAttribute('startPosition');
  const endAttr = sel.getAttribute('endPosition');
  if (startAttr === null || endAttr === null) {
    summary.segmentsSkipped++;
    return;
  }
  const rawStart = parseInt(startAttr, 10);
  const rawEnd = parseInt(endAttr, 10);
  if (Number.isNaN(rawStart) || Number.isNaN(rawEnd) || rawStart < 0 || rawEnd > rawContent.length) {
    summary.segmentsSkipped++;
    return;
  }

  // Extract from the RAW content — this is what the .qde offsets are
  // defined against, regardless of whether doc.content has since been
  // reformatted for readability.
  const text = rawContent.slice(rawStart, rawEnd);
  if (!text.trim()) {
    summary.segmentsSkipped++;
    return;
  }

  // Locate that exact text in the doc's actual stored content (raw or
  // reformatted — doesn't matter, we search either way).
  const loc = locateQuote(doc.content, text);
  if (!loc) {
    // Most likely cause: the excerpt spanned a tab boundary that got
    // replaced by a field label/newline during reformatting.
    summary.segmentsSkipped++;
    return;
  }

  const memo = resolveMemoText(sel, noteMap);

  for (const coding of directChildren(sel, 'Coding')) {
    const codeRef = directChild(coding, 'CodeRef');
    const targetGuid = codeRef?.getAttribute('targetGUID');
    const codeId = targetGuid ? guidMap.get(targetGuid) : null;
    if (!codeId) {
      summary.segmentsSkipped++;
      continue;
    }

    // Dedupe by (doc, code, exact text) — robust to offset drift from
    // reformatting, unlike comparing start/end directly.
    const alreadyCoded = project.codedSegments.some(
      s => s.docId === doc.id && s.codeId === codeId && s.text === text
    );
    if (alreadyCoded) continue;

    const segment: CodedSegment = {
      id: uid('seg'),
      docId: doc.id,
      codeId,
      start: loc.start,
      end: loc.end,
      text,
      createdAt: Date.now(),
      source: 'qdpx-import',
      ...(memo ? { note: memo } : {})
    };
    project.codedSegments.push(segment);
    summary.segmentsCreated++;
    if (memo) summary.memosImported++;
  }
}

function importSources(
  project: Project,
  doc: XMLDocument,
  payload: QdpxParsePayload,
  guidMap: Map<string, ID>,
  noteMap: Map<string, string>,
  summary: QdpxImportSummary
) {
  const sourcesRoot = doc.querySelector('Sources');
  if (!sourcesRoot) return;

  for (const srcEl of Array.from(sourcesRoot.children)) {
    const kind = srcEl.localName || srcEl.tagName;
    const name = srcEl.getAttribute('name') || 'Unnamed source';

    if (kind !== 'TextSource') {
      // PDFSource, PictureSource, AudioSource, VideoSource, etc. — not
      // handled in this MVP. Report it rather than silently dropping it.
      summary.sourcesSkipped.push(`${name} (${kind.replace('Source', '')})`);
      continue;
    }

    const guid = srcEl.getAttribute('guid') || uid('guid');
    const rawContent = resolveSourceText(srcEl, payload);

    if (rawContent === null) {
      summary.sourcesSkipped.push(`${name} (TextSource, content not found)`);
      continue;
    }

    let doc_ = project.docs.find(d => normalize(d.name) === normalize(name));
    if (!doc_) {
      const finalContent = looksTabDelimited(rawContent) ? reformatTabDelimited(rawContent) : rawContent;
      doc_ = {
        id: uid('doc'),
        folderId: null,
        name,
        content: finalContent,
        addedAt: Date.now(),
        sizeBytes: finalContent.length
      };
      project.docs.push(doc_);
      summary.docsCreated++;
    }
    guidMap.set(guid, doc_.id);

    const sourceMemo = resolveMemoText(srcEl, noteMap);
    if (sourceMemo) {
      appendMemo(doc_, 'notes', sourceMemo);
      summary.memosImported++;
    }

    for (const sel of directChildren(srcEl, 'PlainTextSelection')) {
      importSelection(project, sel, doc_, rawContent, guidMap, noteMap, summary);
    }
  }
}

// --- Entry point ---------------------------------------------------------

export function importQdpx(project: Project, payload: QdpxParsePayload): QdpxImportSummary {
  const summary: QdpxImportSummary = {
    codesCreated: 0,
    docsCreated: 0,
    segmentsCreated: 0,
    segmentsSkipped: 0,
    memosImported: 0,
    sourcesSkipped: []
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(payload.qdeXml, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Could not parse project.qde — the .qdpx file may be corrupted or not a valid REFI-QDA export.');
  }

  const guidMap = new Map<string, ID>();
  const noteMap = buildNoteMap(doc);

  importCodebook(project, doc, guidMap, noteMap, summary);
  importSources(project, doc, payload, guidMap, noteMap, summary);

  return summary;
}