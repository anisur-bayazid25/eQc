import { Project } from '../domain';
import { utf16ToQdaRange } from './qdpxOffsets';
import { hashSourceText } from './sourceOriginal';
import { researchRows } from './researchExport';

export interface QdpxExportPayload {
  fileName: string;
  qdeXml: string;
  sourceFiles: Record<string, string>; // zip path -> plain text content
  sourceBytes: Record<string, string>; // zip path -> base64 payload (binary sources, e.g. images)
}

const NS = 'urn:QDA-XML:project:1.0';
const XSI = 'http://www.w3.org/2001/XMLSchema-instance';

// --- Helpers --------------------------------------------------------------

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(b);
  } else {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function esc(s: string): string {
  return (s || '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '')
    .replace(/[\ud800-\udfff]/gu, '\ufffd')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;');
}

function sanitizeFileName(name: string): string {
  return (name || 'project').replace(/[\\/:*?"<>|]/g, '_').trim() || 'project';
}

interface ExchangeImage { w: number; h: number; ext: 'png' | 'jpg'; base64: string }

function prepareImage(dataUrl: string): Promise<ExchangeImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image has no usable dimensions');
        const match = /^data:image\/(png|jpeg);base64,(.+)$/s.exec(dataUrl);
        if (match) {
          resolve({ w: img.naturalWidth, h: img.naturalHeight, ext: match[1] === 'jpeg' ? 'jpg' : 'png', base64: match[2] });
        } else {
          // REFI-QDA accepts PNG/JPEG; convert browser-supported GIF/WebP/BMP etc.
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Could not convert image to PNG');
          context.drawImage(img, 0, 0);
          resolve({ w: canvas.width, h: canvas.height, ext: 'png', base64: canvas.toDataURL('image/png').split(',')[1] });
        }
      } catch (error) { reject(error); }
    };
    img.onerror = () => reject(new Error('Image could not be decoded'));
    img.src = dataUrl;
  });
}

// A memo destined for the project's <Notes> section, referenced from an
// element via <NoteRef targetGUID="..."/>. REFI-QDA treats <Description> as
// the element's short descriptive text, so eQc's coding definition lives there
// and the longer analytic memo lives in a proper Memo object — no custom
// markers, just the standard two slots.
interface QdpxMemo {
  guid: string;
  text: string;
  name: string;
}

function buildNotesXml(memos: QdpxMemo[], files: Record<string, string>): string {
  if (memos.length === 0) return '';
  const notes = memos
    .map(m => {
      files[`sources/${m.guid}.txt`] = m.text;
      return `<Note guid="${m.guid}" name="${esc(m.name)}" plainTextPath="internal://${m.guid}.txt"/>`;
    })
    .join('');
  return `<Notes>${notes}</Notes>`;
}

// Records the memo and returns the <NoteRef> to embed, or '' when there is
// nothing to say. `memos` accumulates across the whole export.
function noteRefFor(memos: QdpxMemo[], text: string, name: string): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  const guid = uuid();
  memos.push({ guid, text: clean, name });
  return `<NoteRef targetGUID="${guid}"/>`;
}

// --- REFI-QDA Project 1.0 schema builders ----------------------------------

function buildCodebook(project: Project, codeGuids: Map<string, string>, memos: QdpxMemo[]): string {
  if (!project.codes.length) return '';
  const emitted = new Set<string>();
  const render = (code: { id: string; name: string; color: string; summary: string; definition?: string }): string => {
    const guid = codeGuids.get(code.id)!;
    if (emitted.has(code.id)) throw new Error('Cannot export a cyclic or duplicated code hierarchy. Fix the code tree before exporting.');
    emitted.add(code.id);
    const children = project.codes.filter(c => c.parentId === code.id);
    // <Description> carries the coding definition; the memo goes to <Notes>.
    const definition = (code.definition || '').trim();
    const memoRef = noteRefFor(memos, code.summary, `Code memo — ${code.name}`);
    const inner =
      (definition ? `<Description>${esc(definition)}</Description>` : '') +
      memoRef +
      children.map(render).join('');
    const color = /^#[0-9a-f]{3}$/i.test(code.color || '') ? '#' + code.color.slice(1).split('').map(c => c + c).join('') : code.color;
    const colorAttr = /^#[0-9a-f]{6}$/i.test(color || '') ? ` color="${color}"` : '';
    return `<Code guid="${guid}" name="${esc(code.name)}" isCodable="true"${colorAttr}>${inner}</Code>`;
  };
  const roots = project.codes.filter(c => !c.parentId || !codeGuids.has(c.parentId));
  const xml = `<CodeBook><Codes>${roots.map(render).join('')}</Codes></CodeBook>`;
  if (emitted.size !== project.codes.length) throw new Error('Cannot export a cyclic or duplicated code hierarchy. Fix the code tree before exporting.');
  return xml;
}

function buildUsers(project: Project) {
  const names = new Set([project.coderName || 'User', ...project.codedSegments.map(s => s.coder), ...(project.codedRegions || []).map(r => r.coder)].filter((s): s is string => !!s));
  const guids = new Map([...names].map(name => [name, uuid()]));
  return { guids, creator: guids.get(project.coderName || 'User')!, xml: `<Users>${[...guids].map(([name, guid], i) => `<User guid="${guid}" id="${i + 1}" name="${esc(name)}"/>`).join('')}</Users>` };
}

function timestamp(value?: number): string {
  return new Date(Number.isFinite(value) && !Number.isNaN(new Date(value!).getTime()) ? value! : Date.now()).toISOString();
}

function buildTextSource(
  project: Project,
  doc: { id: string; name: string; content: string; notes?: string },
  codeGuids: Map<string, string>,
  files: Record<string, string>,
  users: Map<string, string>,
  creator: string,
  richOriginal: string | undefined,
  bytes: Record<string, string>,
  sourceGuids: Map<string,string>
): string {
  const guid = uuid(); sourceGuids.set(doc.id,guid);
  const fileName = `${guid}.txt`;
  files[`sources/${fileName}`] = doc.content;
  if (richOriginal) bytes[`sources/${guid}.docx`] = richOriginal;

  const docMemo = (doc.notes || '').trim();
  const selections = project.codedSegments
    .filter(s => s.docId === doc.id)
    .map(seg => {
      const target = codeGuids.get(seg.codeId);
      if (!target) throw new Error(`Cannot export ${doc.name}: a coded excerpt refers to a missing code.`);
      if (!Number.isInteger(seg.start) || !Number.isInteger(seg.end) || seg.start < 0 || seg.end <= seg.start || seg.end > doc.content.length) throw new Error(`Cannot export ${doc.name}: a coded excerpt has invalid text positions.`);
      const range = utf16ToQdaRange(doc.content, seg.start, seg.end);
      const text = doc.content.slice(seg.start, seg.end);
      const name = (text.replace(/\s+/g, ' ').trim().slice(0, 48)) || 'Selection';
      const note = (seg.note || '').trim();
      const memoXml = note ? `<Description>${esc(note)}</Description>` : '';
      const attribution = seg.coder && users.has(seg.coder) ? ` creatingUser="${users.get(seg.coder)}"` : '';
      const date = timestamp(seg.createdAt);
      const codingGuid=uuid();sourceGuids.set(seg.id,codingGuid);
      return (
        `<PlainTextSelection startPosition="${range.start}" endPosition="${range.end}" guid="${uuid()}" name="${esc(name)}"${attribution} creationDateTime="${date}">` +
        `${memoXml}<Coding guid="${codingGuid}"${attribution} creationDateTime="${date}"><CodeRef targetGUID="${target}"/></Coding>` +
        `</PlainTextSelection>`
      );
    })
    .join('');

  return (
    `<TextSource guid="${guid}" name="${esc(doc.name)}" plainTextPath="internal://${fileName}"${richOriginal ? ` richTextPath="internal://${guid}.docx"` : ''} creatingUser="${creator}">` +
    `${docMemo ? `<Description>${esc(docMemo)}</Description>` : ''}${selections}` +
    `</TextSource>`
  );
}

function buildPictureSource(
  project: Project,
  img: { id: string; name: string; dataUrl: string; notes?: string },
  codeGuids: Map<string, string>,
  size: ExchangeImage,
  bytes: Record<string, string>,
  users: Map<string, string>,
  creator: string,
  sourceGuids: Map<string,string>
): string {
  const guid = uuid(); sourceGuids.set(img.id,guid);
  const fileName = `${guid}.${size.ext}`;
  bytes[`sources/${fileName}`] = size.base64;

  const regions = (project.codedRegions || [])
    .filter(r => r.imageId === img.id)
    .map(r => {
      if (!codeGuids.has(r.codeId)) throw new Error(`Cannot export ${img.name}: an image region refers to a missing code.`);
      if (![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.width <= 0 || r.height <= 0) throw new Error(`Cannot export ${img.name}: an image region has invalid coordinates.`);
      const firstX = Math.max(0, Math.min(Math.floor(r.x * size.w), size.w - 1));
      const firstY = Math.max(0, Math.min(Math.floor(r.y * size.h), size.h - 1));
      const secondX = Math.max(firstX + 1, Math.min(Math.ceil((r.x + r.width) * size.w), size.w));
      const secondY = Math.max(firstY + 1, Math.min(Math.ceil((r.y + r.height) * size.h), size.h));
      const note = (r.note || '').trim();
      const memoXml = note ? `<Description>${esc(note)}</Description>` : '';
      const attribution = r.coder && users.has(r.coder) ? ` creatingUser="${users.get(r.coder)}"` : '';
      const date = timestamp(r.createdAt);
      const codingGuid=uuid();sourceGuids.set(r.id,codingGuid);
      return (
        `<PictureSelection firstX="${firstX}" firstY="${firstY}" secondX="${secondX}" secondY="${secondY}" guid="${uuid()}" name="Region"${attribution} creationDateTime="${date}">` +
        `${memoXml}<Coding guid="${codingGuid}"${attribution} creationDateTime="${date}"><CodeRef targetGUID="${codeGuids.get(r.codeId)}"/></Coding>` +
        `</PictureSelection>`
      );
    })
    .join('');

  const imgMemo = (img.notes || '').trim();
  return (
    `<PictureSource guid="${guid}" name="${esc(img.name)}" path="internal://${fileName}" creatingUser="${creator}">` +
    `${imgMemo ? `<Description>${esc(imgMemo)}</Description>` : ''}${regions}` +
    `</PictureSource>`
  );
}

// --- Entry point ---------------------------------------------------------

export async function buildQdpxExport(project: Project): Promise<QdpxExportPayload> {
  const codeGuids = new Map<string, string>();
  for (const c of project.codes) codeGuids.set(c.id, uuid());

  const files: Record<string, string> = {};
  const bytes: Record<string, string> = {};
  const memos: QdpxMemo[] = [];
  const users = buildUsers(project);

  if (project.codedSegments.some(s => !project.docs.some(d => d.id === s.docId)) || (project.codedRegions || []).some(r => !(project.images || []).some(i => i.id === r.imageId))) throw new Error('Cannot export coding whose source is missing. Restore or remove the affected coding first.');

  const codebook = buildCodebook(project, codeGuids, memos);
  const sourceGuids = new Map<string,string>();
  const textParts: string[] = [];
  for (const doc of project.docs) {
    const original = doc.original;
    const originalMatches = original && original.textHash === await hashSourceText(doc.content);
    const rich = originalMatches && original.format === 'docx' ? original.base64 : undefined;
    const text = buildTextSource(project, doc, codeGuids, files, users.guids, users.creator, rich, bytes, sourceGuids);
    if (originalMatches && original.format === 'pdf') {
      const guid = uuid();
      sourceGuids.set(doc.id,guid);
      bytes[`sources/${guid}.pdf`] = original.base64;
      const representation = text.replace(/^<TextSource/, '<Representation').replace(/<\/TextSource>$/, '</Representation>');
      textParts.push(`<PDFSource guid="${guid}" name="${esc(doc.name)}" path="internal://${guid}.pdf" creatingUser="${users.creator}">${representation}</PDFSource>`);
    } else textParts.push(text);
  }
  const textSources = textParts.join('');

  const images = project.images || [];
  const sizes: Record<string, ExchangeImage> = {};
  for (const img of images) {
    try { sizes[img.id] = await prepareImage(img.dataUrl); }
    catch { throw new Error(`Cannot export image ${img.name}: the image could not be decoded or converted to PNG.`); }
  }
  const pictureSources = images
    .map(img => buildPictureSource(project, img, codeGuids, sizes[img.id], bytes, users.guids, users.creator, sourceGuids))
    .join('');

  if ([project.cases,project.groups,project.annotations,project.memos,project.queries].some(items=>items?.length)) {
    // Standard Notes provide readable records; the labelled appendix retains app-specific semantics.
    const rows=researchRows(project);
    for(const row of rows.slice(1).filter(r=>['Case','Attribute','Case link','Group','Annotation','Saved query'].includes(r[0])||r[0].startsWith('Memo:')))
      memos.push({guid:uuid(),name:'eQc research record — '+row[0]+' — '+row[1],text:row.map((v,i)=>v?rows[0][i]+': '+v:'').filter(Boolean).join('\n')});
    const references=Object.fromEntries([...codeGuids,...sourceGuids]);
    const records={cases:project.cases,groups:project.groups,annotations:project.annotations,memos:project.memos,queries:project.queries,
      codedSegments:project.codedSegments.map(s=>({id:s.id,docId:s.docId,codeId:s.codeId,start:s.start,end:s.end,coder:s.coder})),
      codedRegions:(project.codedRegions||[]).map(r=>({id:r.id,imageId:r.imageId,codeId:r.codeId,x:r.x,y:r.y,width:r.width,height:r.height,coder:r.coder}))};
    memos.push({guid:uuid(),name:'eQc research archive (JSON, version 1)',text:JSON.stringify({format:'eQc-research',version:1,references,records})});
  }

  const nowIso = new Date().toISOString();
  const qdeXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Project xmlns="${NS}" xmlns:xsi="${XSI}" xsi:schemaLocation="${NS} http://schema.qdasoftware.org/versions/Project/v1.0/Project.xsd" ` +
    `name="${esc(project.name)}" origin="eQc" creatingUserGUID="${users.creator}" creationDateTime="${nowIso}">` +
    users.xml +
    codebook +
    (textSources || pictureSources ? `<Sources>${textSources}${pictureSources}</Sources>` : '') +
    buildNotesXml(memos, files) +
    `</Project>`;

  return {
    fileName: `${sanitizeFileName(project.name)}.qdpx`,
    qdeXml,
    sourceFiles: files,
    sourceBytes: bytes
  };
}

// Codebook-only QDPX uses the same Project 1.0 schema without a Sources section.
// with no sources or codings — for sharing the code tree itself.
export function buildQdpxCodebookExport(project: Project): QdpxExportPayload {
  const codeGuids = new Map<string, string>();
  for (const c of project.codes) codeGuids.set(c.id, uuid());
  const memos: QdpxMemo[] = [];
  const files: Record<string, string> = {};
  const users = buildUsers(project);

  const nowIso = new Date().toISOString();
  const qdeXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Project xmlns="${NS}" xmlns:xsi="${XSI}" xsi:schemaLocation="${NS} http://schema.qdasoftware.org/versions/Project/v1.0/Project.xsd" ` +
    `name="${esc(project.name)}" origin="eQc" creatingUserGUID="${users.creator}" creationDateTime="${nowIso}">` +
    users.xml +
    buildCodebook(project, codeGuids, memos) +
    buildNotesXml(memos, files) +
    `</Project>`;

  return {
    fileName: `${sanitizeFileName(project.name)}_Codebook.qdpx`,
    qdeXml,
    sourceFiles: files,
    sourceBytes: {}
  };
}
