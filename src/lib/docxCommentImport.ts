import { Project, Code, SourceDoc, CodedSegment, ID, uid, randomColor } from '../domain';

export interface DocxCommentParsePayload {
  fileName: string;
  documentXml: string;
  commentsXml: string;
}

export interface DocxCommentImportOptions {
  separator: string;
  firstFieldIsSpeaker: boolean;      // e.g. "P9;Parent;Child;Excerpt" — strip field 1 as speaker info
  lastFieldIsExcerptEcho: boolean;   // e.g. "...;Excerpt" — the final field is a copy of the highlighted text, not a code
}

export interface DocxCommentImportSummary {
  docCreated: boolean;
  codesCreated: number;
  segmentsCreated: number;
  commentsSkipped: number;
  excerptMismatches: 0; // comment's echoed excerpt text didn't match the actual highlighted text
}

function normalize(s: string): string {
  return (s || '').trim().toLowerCase();
}

// Same substring-search approach as csvImport.ts / qdpxImport.ts: locates
// the exact quoted text in the doc's current content rather than trusting
// raw offsets, so this stays correct whether the doc is brand-new or
// already existed with slightly different content.
function locateQuote(content: string, quote: string): { start: number; end: number } | null {
  const idx = content.indexOf(quote);
  if (idx === -1) return null;
  return { start: idx, end: idx + quote.length };
}

function findOrCreateCode(project: Project, name: string, parentId: ID | null): Code {
  const trimmed = name.trim();
  const existing = project.codes.find(c => c.parentId === parentId && normalize(c.name) === normalize(trimmed));
  if (existing) return existing;
  const created: Code = { id: uid('code'), name: trimmed, color: randomColor(project.codes.length), parentId, summary: '', createdAt: Date.now() };
  project.codes.push(created);
  return created;
}

function localName(el: Element): string {
  return el.localName || el.tagName.replace(/^.*:/, '');
}

function attr(el: Element, name: string): string | null {
  // XML attribute names sometimes keep their namespace prefix literally
  // (w:id) and sometimes don't, depending on parser behavior — check both.
  return el.getAttribute(`w:${name}`) || el.getAttribute(name);
}

// Walks word/document.xml in document order, building the same kind of
// plain-text string your doc.content already uses, while recording the
// character offset at every commentRangeStart/End marker.
function extractDocXmlTextAndCommentRanges(documentXmlText: string): {
  plainText: string;
  commentRanges: Map<string, { start: number; end: number }>;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXmlText, 'application/xml');
  const body = doc.getElementsByTagName('w:body')[0] || doc.getElementsByTagName('body')[0];

  let text = '';
  const starts = new Map<string, number>();
  const ranges = new Map<string, { start: number; end: number }>();

  function walk(node: Node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType !== 1) continue; // ELEMENT_NODE
      const el = child as Element;
      const local = localName(el);

      if (local === 'commentRangeStart') {
        const id = attr(el, 'id');
        if (id) starts.set(id, text.length);
        continue;
      }
      if (local === 'commentRangeEnd') {
        const id = attr(el, 'id');
        if (id && starts.has(id)) ranges.set(id, { start: starts.get(id)!, end: text.length });
        continue;
      }
      if (local === 't') {
        text += el.textContent || '';
        continue;
      }
      if (local === 'tab') {
        text += '\t';
        continue;
      }
      if (local === 'br' || local === 'cr') {
        text += '\n';
        continue;
      }

      walk(el);
      if (local === 'p') text += '\n';
    }
  }

  if (body) walk(body);
  return { plainText: text, commentRanges: ranges };
}

function extractComments(commentsXmlText: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!commentsXmlText.trim()) return map;

  const parser = new DOMParser();
  const doc = parser.parseFromString(commentsXmlText, 'application/xml');
  const commentEls = Array.from(doc.getElementsByTagName('*')).filter(el => localName(el) === 'comment');

  for (const c of commentEls) {
    const id = attr(c, 'id');
    if (!id) continue;
    const tNodes = Array.from(c.getElementsByTagName('*')).filter(el => localName(el) === 't');
    map.set(id, tNodes.map(t => t.textContent || '').join(''));
  }
  return map;
}

export function importDocxComments(
  project: Project,
  payload: DocxCommentParsePayload,
  options: DocxCommentImportOptions
): DocxCommentImportSummary {
  const summary: DocxCommentImportSummary = { docCreated: false, codesCreated: 0, segmentsCreated: 0, commentsSkipped: 0, excerptMismatches: 0 };

  const { plainText, commentRanges } = extractDocXmlTextAndCommentRanges(payload.documentXml);
  const commentTexts = extractComments(payload.commentsXml);

  const docName = payload.fileName.replace(/\.docx$/i, '');
  let doc: SourceDoc | undefined = project.docs.find(d => normalize(d.name) === normalize(docName));
  if (!doc) {
    doc = { id: uid('doc'), folderId: null, name: docName, content: plainText, addedAt: Date.now(), sizeBytes: plainText.length };
    project.docs.push(doc);
    summary.docCreated = true;
  }

  for (const [, range] of commentRanges) {
    const commentId = Array.from(commentRanges.entries()).find(([, r]) => r === range)?.[0];
    const rawComment = commentId ? commentTexts.get(commentId) : undefined;
    if (!rawComment || !rawComment.trim()) { summary.commentsSkipped++; continue; }

    const fields = rawComment.split(options.separator).map(p => p.trim()).filter(Boolean);
    if (fields.length === 0) { summary.commentsSkipped++; continue; }

    let codeFields = [...fields];
    let speakerField: string | undefined;
    let excerptEcho: string | undefined;

    if (options.lastFieldIsExcerptEcho && codeFields.length > 0) {
      excerptEcho = codeFields.pop();
    }
    if (options.firstFieldIsSpeaker && codeFields.length > 0) {
      speakerField = codeFields.shift();
    }

    // Nothing left to build a code path from (e.g. a comment that was only
    // ever a speaker tag + excerpt, no actual code) — skip rather than
    // silently creating an empty/junk code.
    if (codeFields.length === 0) { summary.commentsSkipped++; continue; }

    const rawStart = Math.max(0, Math.min(range.start, plainText.length));
    const rawEnd = Math.max(rawStart, Math.min(range.end, plainText.length));
    const text = plainText.slice(rawStart, rawEnd);
    if (!text.trim()) { summary.commentsSkipped++; continue; }

    const loc = locateQuote(doc.content, text);
    if (!loc) { summary.commentsSkipped++; continue; }

    if (excerptEcho && normalize(excerptEcho) !== normalize(text)) {
      summary.excerptMismatches++;
    }

    let parentId: ID | null = null;
    let targetCode: Code | null = null;
    for (const part of codeFields) {
      const before = project.codes.length;
      targetCode = findOrCreateCode(project, part, parentId);
      if (project.codes.length > before) summary.codesCreated++;
      parentId = targetCode.id;
    }
    if (!targetCode) continue;

    const alreadyCoded = project.codedSegments.some(
      s => s.docId === doc!.id && s.codeId === targetCode!.id && s.text === text
    );
    if (alreadyCoded) continue;

    const segment: CodedSegment = {
      id: uid('seg'),
      docId: doc.id,
      codeId: targetCode.id,
      start: loc.start,
      end: loc.end,
      text,
      createdAt: Date.now(),
      source: 'docx-comment-import',
      ...(speakerField ? { note: `Speaker(s): ${speakerField}` } : {})
    };
    project.codedSegments.push(segment);
    summary.segmentsCreated++;
  }

  return summary;
}