import { Project, Code, SourceDoc, CodedSegment, ImageSource, CodedRegion, ID, uid, colorForNewCode } from '../domain';
import { qdaToUtf16Range } from './qdpxOffsets';
import { hashSourceText } from './sourceOriginal';
import { mergeResearch } from './researchMerge';

export interface QdpxParsePayload {
  fileName: string;
  qdeXml: string;
  sourceFiles: Record<string, string>; // zip path -> text content
  sourceBytes?: Record<string, string>; // zip path -> base64 payload (images etc.)
}

export interface QdpxImportSummary {
  codesCreated: number;
  docsCreated: number;
  imagesCreated: number;
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

function appendMemo(target: { summary?: string; definition?: string; notes?: string; note?: string }, field: 'summary' | 'definition' | 'notes' | 'note', text: string) {
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

function buildNoteMap(doc: XMLDocument, payload: QdpxParsePayload): Map<string, string> {
  const map = new Map<string, string>();
  const notesEl = doc.querySelector('Notes');
  if (!notesEl) return map;
  for (const note of directChildren(notesEl, 'Note')) {
    const guid = note.getAttribute('guid');
    if (!guid) continue;
    const content = directChild(note, 'PlainTextContent');
    const path = (note.getAttribute('plainTextPath') || '').replace(/^internal:\/\//i, '').replace(/^\/+/, '');
    const file = path ? Object.keys(payload.sourceFiles).find(k => k.endsWith(path) || k === path) : undefined;
    const text = textOf(content) || (file ? payload.sourceFiles[file] : '') || note.getAttribute('name') || '';
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

// Modern codebooks split Description definitions from NoteRef memos.
// importCodeTree also handles legacy projects that stored memos in Description.
// Sources/selections use resolveMemoText instead.
function resolveDefinition(el: Element): string {
  return textOf(directChild(el, 'Description')).trim();
}

function resolveNoteMemo(el: Element, noteMap: Map<string, string>): string {
  const parts: string[] = [];
  for (const ref of directChildren(el, 'NoteRef')) {
    const guid = ref.getAttribute('targetGUID');
    if (guid && noteMap.has(guid)) parts.push(noteMap.get(guid)!);
  }
  return parts.join('\n\n');
}

function coderForCoding(coding: Element, selection: Element): string | undefined {
  const guid = coding.getAttribute('creatingUser') || selection.getAttribute('creatingUser');
  if (!guid) return undefined;
  const users = selection.ownerDocument.querySelector('Users');
  return users ? directChildren(users, 'User').find(u => u.getAttribute('guid') === guid)?.getAttribute('name') || undefined : undefined;
}

// --- Codebook ---------------------------------------------------------

function importCodeTree(
  project: Project,
  guidMap: Map<string, ID>,
  noteMap: Map<string, string>,
  el: Element,
  parentId: ID | null,
  summary: QdpxImportSummary,
  modernDefinitions: boolean
) {
  const guid = el.getAttribute('guid') || uid('guid');
  const name = el.getAttribute('name') || 'Unnamed code';
  const color = el.getAttribute('color');
  const codesBefore = project.codes.length;

  const code = findOrCreateCode(project, guidMap, guid, name, color, parentId);
  if (project.codes.length > codesBefore) summary.codesCreated++;

  const description = resolveDefinition(el);
  // Legacy project exports used Description for memos. Modern archives and
  // standalone QDC codebooks preserve the separate definition slot.
  const definitionSlot = modernDefinitions || directChildren(el, 'NoteRef').length > 0;
  if (description) {
    appendMemo(code, definitionSlot ? 'definition' : 'summary', description);
    if (!definitionSlot) summary.memosImported++;
  }
  const memo = resolveNoteMemo(el, noteMap);
  if (memo) {
    appendMemo(code, 'summary', memo);
    summary.memosImported++;
  }

  // Standard REFI-QDA nests Code directly; retain legacy eQc SubCodes support.
  const childEls = [...directChildren(el, 'Code')];
  const subCodes = directChild(el, 'SubCodes');
  if (subCodes) childEls.push(...directChildren(subCodes, 'Code'));
  for (const child of childEls) {
    importCodeTree(project, guidMap, noteMap, child, code.id, summary, modernDefinitions);
  }
}

function importCodebook(project: Project, doc: XMLDocument, guidMap: Map<string, ID>, noteMap: Map<string, string>, summary: QdpxImportSummary) {
  const codeBook = doc.querySelector('CodeBook');
  if (!codeBook) return;
  const codesRoot = directChild(codeBook, 'Codes');
  if (!codesRoot) return;
  const root = doc.documentElement;
  const modernDefinitions = root.localName === 'CodeBook' ||
    !!root.getAttribute('origin')?.includes('eQc; code descriptions=definitions') ||
    (root.getAttribute('origin') === 'eQc' && Array.from(root.getElementsByTagNameNS('*', 'Code')).some(code => directChildren(code, 'NoteRef').length > 0));
  for (const codeEl of directChildren(codesRoot, 'Code')) {
    importCodeTree(project, guidMap, noteMap, codeEl, null, summary, modernDefinitions);
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

function base64ToImageDataUrl(base64: string, entryName: string): string {
  const m = /\.(png|jpe?g|gif|webp|bmp)$/i.exec(entryName || '');
  const ext = (m ? m[1].toLowerCase() : 'png').replace('jpeg', 'jpg');
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${base64}`;
}

function getImageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    try {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    } catch {
      resolve({ w: 0, h: 0 });
    }
  });
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
  // Legacy eQc 2.0 exports used UTF-16/exclusive positions.
  const legacy = sel.ownerDocument.documentElement.namespaceURI === 'urn:QDA-XML:project:2.0';
  const rawRange = legacy
    ? (rawStart >= 0 && rawEnd > rawStart && rawEnd <= rawContent.length ? { start: rawStart, end: rawEnd } : null)
    : qdaToUtf16Range(rawContent, rawStart, rawEnd);
  if (!rawRange) {
    summary.segmentsSkipped++;
    return;
  }

  // Extract from the RAW content — this is what the .qde offsets are
  // defined against, regardless of whether doc.content has since been
  // reformatted for readability.
  const text = rawContent.slice(rawRange.start, rawRange.end);
  if (!text.trim()) {
    summary.segmentsSkipped++;
    return;
  }

  // Locate that exact text in the doc's actual stored content (raw or
  // reformatted — doesn't matter, we search either way).
  const loc = doc.content === rawContent ? rawRange : locateQuote(doc.content, text);
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
    const coder = coderForCoding(coding, sel);
    if (!codeId) {
      summary.segmentsSkipped++;
      continue;
    }

    // Keep repeated passages and separate coders while repeat imports remain idempotent.
    const alreadyCoded = project.codedSegments.find(
      s => s.docId === doc.id && s.codeId === codeId && s.start === loc.start && s.end === loc.end && (s.coder || '') === (coder || '')
    );
    if (alreadyCoded) { const guid=coding.getAttribute('guid');if(guid)guidMap.set(guid,alreadyCoded.id);continue; }

    const segment: CodedSegment = {
      id: uid('seg'),
      docId: doc.id,
      codeId,
      start: loc.start,
      end: loc.end,
      text,
      createdAt: Date.now(),
      source: 'qdpx-import',
      ...(coder ? { coder } : {}),
      ...(memo ? { note: memo } : {})
    };
    project.codedSegments.push(segment);
    const codingGuid=coding.getAttribute('guid');if(codingGuid)guidMap.set(codingGuid,segment.id);
    summary.segmentsCreated++;
    if (memo) summary.memosImported++;
  }
}

function importPictureSelection(
  project: Project,
  sel: Element,
  image: ImageSource,
  size: { w: number; h: number },
  guidMap: Map<string, ID>,
  noteMap: Map<string, string>,
  summary: QdpxImportSummary
) {
  if (!size.w || !size.h) {
    summary.segmentsSkipped++;
    return;
  }
  const firstX = parseInt(sel.getAttribute('firstX') || '', 10);
  const firstY = parseInt(sel.getAttribute('firstY') || '', 10);
  const secondX = parseInt(sel.getAttribute('secondX') || '', 10);
  const secondY = parseInt(sel.getAttribute('secondY') || '', 10);
  if ([firstX, firstY, secondX, secondY].some(Number.isNaN)) {
    summary.segmentsSkipped++;
    return;
  }

  const x = Math.max(0, Math.min(firstX, size.w)) / size.w;
  const y = Math.max(0, Math.min(firstY, size.h)) / size.h;
  const ex = Math.max(0, Math.min(secondX, size.w)) / size.w;
  const ey = Math.max(0, Math.min(secondY, size.h)) / size.h;
  const width = Math.abs(ex - x);
  const height = Math.abs(ey - y);
  if (width < 0.001 || height < 0.001) {
    summary.segmentsSkipped++;
    return;
  }

  const memo = resolveMemoText(sel, noteMap);

  for (const coding of directChildren(sel, 'Coding')) {
    const codeRef = directChild(coding, 'CodeRef');
    const targetGuid = codeRef?.getAttribute('targetGUID');
    const codeId = targetGuid ? guidMap.get(targetGuid) : null;
    const coder = coderForCoding(coding, sel);
    if (!codeId) {
      summary.segmentsSkipped++;
      continue;
    }

    const alreadyCoded = (project.codedRegions || []).find(
      r => r.imageId === image.id && r.codeId === codeId &&
        Math.abs(r.x - x) < 0.001 && Math.abs(r.y - y) < 0.001 &&
        Math.abs(r.width - width) < 0.001 && Math.abs(r.height - height) < 0.001 && (r.coder || '') === (coder || '')
    );
    if (alreadyCoded) { const guid=coding.getAttribute('guid');if(guid)guidMap.set(guid,alreadyCoded.id);continue; }

    const region: CodedRegion = {
      id: uid('region'),
      imageId: image.id,
      codeId,
      x,
      y,
      width,
      height,
      createdAt: Date.now(),
      ...(coder ? { coder } : {}),
      ...(memo ? { note: memo } : {})
    };
    if (!project.codedRegions) project.codedRegions = [];
    project.codedRegions.push(region);
    const codingGuid=coding.getAttribute('guid');if(codingGuid)guidMap.set(codingGuid,region.id);
    summary.segmentsCreated++;
    if (memo) summary.memosImported++;
  }
}

async function importPictureSource(
  project: Project,
  srcEl: Element,
  payload: QdpxParsePayload,
  guidMap: Map<string, ID>,
  noteMap: Map<string, string>,
  summary: QdpxImportSummary
) {
  const name = srcEl.getAttribute('name') || 'Unnamed picture';
  const guid = srcEl.getAttribute('guid') || uid('guid');

  const path = srcEl.getAttribute('path') || srcEl.getAttribute('picturePath') || '';
  const cleaned = path.replace(/^internal:\/\//i, '').replace(/^\/+/, '');
  const entry = Object.keys(payload.sourceBytes || {}).find(k => k.endsWith(cleaned) || k === cleaned);
  if (!entry) {
    summary.sourcesSkipped.push(`${name} (PictureSource, image bytes not found)`);
    return;
  }
  const dataUrl = base64ToImageDataUrl(payload.sourceBytes![entry], entry);

  let image = (project.images || []).find(i => normalize(i.name) === normalize(name));
  if (!image) {
    image = {
      id: uid('img'),
      folderId: null,
      name,
      dataUrl,
      addedAt: Date.now(),
      sizeBytes: dataUrl.length
    };
    if (!project.images) project.images = [];
    project.images.push(image);
    summary.imagesCreated++;
  }
  guidMap.set(guid, image.id);

  const sourceMemo = resolveMemoText(srcEl, noteMap);
  if (sourceMemo) {
    appendMemo(image, 'notes', sourceMemo);
    summary.memosImported++;
  }

  const size = await getImageSize(dataUrl);
  for (const sel of directChildren(srcEl, 'PictureSelection')) {
    importPictureSelection(project, sel, image, size, guidMap, noteMap, summary);
  }
}

async function importSources(
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

    if (kind === 'PictureSource') {
      // Async: image dimension decoding is needed to normalize the coded
      // region coordinates into the app's 0–1 space.
      await importPictureSource(project, srcEl, payload, guidMap, noteMap, summary);
      continue;
    }

    const textSource = kind === 'PDFSource' ? directChild(srcEl, 'Representation') : srcEl;
    if ((kind !== 'TextSource' && kind !== 'PDFSource') || !textSource) {
      // PDFSource, AudioSource, VideoSource, etc. — not handled in this MVP.
      // Report it rather than silently dropping it.
      summary.sourcesSkipped.push(`${name} (${kind.replace('Source', '')})`);
      continue;
    }

    const guid = srcEl.getAttribute('guid') || uid('guid');
    const rawContent = resolveSourceText(textSource, payload);

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
    const format = kind === 'PDFSource' ? 'pdf' : 'docx';
    const richPath = (srcEl.getAttribute(kind === 'PDFSource' ? 'path' : 'richTextPath') || '').replace(/^internal:\/\//i, '').replace(/^\/+/, '');
    const richEntry = richPath && richPath.toLowerCase().endsWith(`.${format}`) ? Object.keys(payload.sourceBytes || {}).find(k => k.endsWith(richPath) || k === richPath) : undefined;
    if (richEntry && !doc_.original) doc_.original = {
      name: name.toLowerCase().endsWith(`.${format}`) ? name : `${name}.${format}`, format,
      base64: payload.sourceBytes![richEntry], textHash: await hashSourceText(rawContent), textChanged: doc_.content !== rawContent
    };

    const sourceMemo = resolveMemoText(srcEl, noteMap) || resolveMemoText(textSource, noteMap);
    if (sourceMemo) {
      appendMemo(doc_, 'notes', sourceMemo);
      summary.memosImported++;
    }

    for (const sel of directChildren(textSource, 'PlainTextSelection')) {
      importSelection(project, sel, doc_, rawContent, guidMap, noteMap, summary);
    }
  }
}

// --- Entry point ---------------------------------------------------------

export async function importQdpx(project: Project, payload: QdpxParsePayload): Promise<QdpxImportSummary> {
  const summary: QdpxImportSummary = {
    codesCreated: 0,
    docsCreated: 0,
    imagesCreated: 0,
    segmentsCreated: 0,
    segmentsSkipped: 0,
    memosImported: 0,
    sourcesSkipped: []
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(payload.qdeXml, 'application/xml');

  // Detect a malformed document by checking the root element directly. The
  // browser's DOMParser injects a <parsererror> element (which querySelector
  // would find), but this code also runs under a plain XML DOM in tests, where
  // a failed parse yields a document whose root is the error itself.
  const docEl = doc.documentElement;
  if (!docEl || docEl.localName === 'parsererror' || docEl.nodeName === 'parsererror') {
    throw new Error('Could not parse project.qde — the .qdpx file may be corrupted or not a valid REFI-QDA export.');
  }

  if (!['Project', 'CodeBook'].includes(docEl.localName)) throw new Error('Expected a REFI-QDA Project or CodeBook XML document.');

  const guidMap = new Map<string, ID>();
  const noteMap = buildNoteMap(doc, payload);

  importCodebook(project, doc, guidMap, noteMap, summary);
  await importSources(project, doc, payload, guidMap, noteMap, summary);

  const archive = Array.from(doc.getElementsByTagNameNS('*','Note')).find(n=>n.getAttribute('name')==='eQc research archive (JSON, version 1)');
  if(archive) {
    const text=noteMap.get(archive.getAttribute('guid')||'');
    if(text) {
      const data=JSON.parse(text);
      if(data.format!=='eQc-research'||data.version!==1||!data.records||!data.references)throw new Error('Unsupported research archive.');
      const refs=new Map<string,string>(Object.entries(data.references).flatMap(([id,guid])=>guidMap.has(String(guid))?[[id,guidMap.get(String(guid))!]]:[]));
      for(const key of ['cases','groups','annotations','memos','queries','codedSegments','codedRegions'])if(data.records[key]!==undefined&&!Array.isArray(data.records[key]))throw new Error('Invalid research archive collection.');
      mergeResearch(project,{...data.records,docs:[],codes:[],folders:[],codedSegments:data.records.codedSegments||[]} as Project,refs,refs,refs,refs);
    }
  }

  {
    const referenced=new Set(Array.from(doc.getElementsByTagNameNS('*','NoteRef')).map(n=>n.getAttribute('targetGUID')));
    for(const note of Array.from(doc.getElementsByTagNameNS('*','Note'))) {
      const guid=note.getAttribute('guid'),text=noteMap.get(guid||'');if(!text||referenced.has(guid))continue;
      if(archive&&(note===archive||(note.getAttribute('name')||'').startsWith('eQc research record — ')))continue;
      project.memos ||= [];const title=note.getAttribute('name')||'Imported memo';
      if(!project.memos.some(m=>m.title===title&&m.text===text)) {
        project.memos.push({id:uid('memo'),title,text,kind:'analytic',docIds:[],codeIds:[],caseIds:[],segmentIds:[],createdAt:Date.now(),updatedAt:Date.now()});summary.memosImported++;
      }
    }
  }

  return summary;
}
