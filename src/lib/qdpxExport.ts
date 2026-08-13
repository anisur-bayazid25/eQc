import { Project } from '../domain';

export interface QdpxExportPayload {
  fileName: string;
  qdeXml: string;
  sourceFiles: Record<string, string>; // zip path -> plain text content
  sourceBytes: Record<string, string>; // zip path -> base64 payload (binary sources, e.g. images)
}

const NS = 'urn:QDA-XML:project:2.0';
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFileName(name: string): string {
  return (name || 'project').replace(/[\\/:*?"<>|]/g, '_').trim() || 'project';
}

function imageExt(dataUrl: string): string {
  const m = /^data:image\/([a-zA-Z0-9.+-]+);/.exec(dataUrl || '');
  const t = (m ? m[1] : '').toLowerCase();
  if (t === 'jpeg') return 'jpg';
  if (t === 'svg+xml') return 'svg';
  if (['png', 'jpg', 'gif', 'webp', 'bmp', 'avif'].includes(t)) return t;
  return 'png';
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

// --- REFI-QDA-2 builders ---------------------------------------------------

function buildCodebook(project: Project, codeGuids: Map<string, string>): string {
  const render = (code: { id: string; name: string; color: string; summary: string }): string => {
    const guid = codeGuids.get(code.id)!;
    const children = project.codes.filter(c => c.parentId === code.id);
    const summary = (code.summary || '').trim();
    const inner =
      (summary ? `<Description>${esc(summary)}</Description>` : '') +
      (children.length > 0 ? `<SubCodes>${children.map(render).join('')}</SubCodes>` : '');
    const colorAttr = code.color ? ` color="${esc(code.color)}"` : '';
    return `<Code guid="${guid}" name="${esc(code.name)}" isCodable="true"${colorAttr}>${inner}</Code>`;
  };
  const roots = project.codes.filter(c => !c.parentId);
  return (
    `<CodeBook guid="${uuid()}" name="${esc(project.name)}">` +
    `<Codes>${roots.map(render).join('')}</Codes>` +
    `</CodeBook>`
  );
}

function buildTextSource(
  project: Project,
  doc: { id: string; name: string; content: string; notes?: string },
  codeGuids: Map<string, string>,
  files: Record<string, string>
): string {
  const guid = uuid();
  const fileName = `${guid}.txt`;
  files[`Sources/${fileName}`] = doc.content;

  const docMemo = (doc.notes || '').trim();
  const selections = project.codedSegments
    .filter(s => s.docId === doc.id)
    .map(seg => {
      const target = codeGuids.get(seg.codeId);
      if (!target) return '';
      if (seg.start < 0 || seg.end <= seg.start || seg.end > doc.content.length) return '';
      const text = doc.content.slice(seg.start, seg.end);
      const name = (text.replace(/\s+/g, ' ').trim().slice(0, 48)) || 'Selection';
      const note = (seg.note || '').trim();
      const memoXml = note ? `<Description>${esc(note)}</Description>` : '';
      return (
        `<PlainTextSelection startPosition="${seg.start}" endPosition="${seg.end}" guid="${uuid()}" name="${esc(name)}">` +
        `${memoXml}<Coding guid="${uuid()}"><CodeRef targetGUID="${target}"/></Coding>` +
        `</PlainTextSelection>`
      );
    })
    .join('');

  return (
    `<TextSource guid="${guid}" name="${esc(doc.name)}" plainTextPath="internal://${fileName}">` +
    `${docMemo ? `<Description>${esc(docMemo)}</Description>` : ''}${selections}` +
    `</TextSource>`
  );
}

function buildPictureSource(
  project: Project,
  img: { id: string; name: string; dataUrl: string; notes?: string },
  codeGuids: Map<string, string>,
  size: { w: number; h: number },
  bytes: Record<string, string>
): string {
  const guid = uuid();
  const ext = imageExt(img.dataUrl);
  const fileName = `${guid}.${ext}`;
  const body = (img.dataUrl.split(',')[1] || '');
  bytes[`Sources/${fileName}`] = body;

  const regions = (project.codedRegions || [])
    .filter(r => r.imageId === img.id && codeGuids.has(r.codeId))
    .map(r => {
      if (!size.w || !size.h) return '';
      const firstX = Math.min(Math.round(r.x * size.w), size.w);
      const firstY = Math.min(Math.round(r.y * size.h), size.h);
      const secondX = Math.min(Math.round((r.x + r.width) * size.w), size.w);
      const secondY = Math.min(Math.round((r.y + r.height) * size.h), size.h);
      const note = (r.note || '').trim();
      const memoXml = note ? `<Description>${esc(note)}</Description>` : '';
      return (
        `<PictureSelection firstX="${firstX}" firstY="${firstY}" secondX="${secondX}" secondY="${secondY}" guid="${uuid()}" name="Region">` +
        `${memoXml}<Coding guid="${uuid()}"><CodeRef targetGUID="${codeGuids.get(r.codeId)}"/></Coding>` +
        `</PictureSelection>`
      );
    })
    .join('');

  const imgMemo = (img.notes || '').trim();
  return (
    `<PictureSource guid="${guid}" name="${esc(img.name)}" path="internal://${fileName}">` +
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

  const codebook = buildCodebook(project, codeGuids);
  const textSources = project.docs
    .map(doc => buildTextSource(project, doc, codeGuids, files))
    .join('');

  const images = project.images || [];
  const sizes: Record<string, { w: number; h: number }> = {};
  for (const img of images) sizes[img.id] = await getImageSize(img.dataUrl);
  const pictureSources = images
    .map(img => buildPictureSource(project, img, codeGuids, sizes[img.id] || { w: 0, h: 0 }, bytes))
    .join('');

  const nowIso = new Date().toISOString();
  const qdeXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Project xmlns="${NS}" xmlns:xsi="${XSI}" xsi:schemaLocation="${NS} project.xsd" ` +
    `guid="${uuid()}" name="${esc(project.name)}" creationDateTime="${nowIso}">` +
    `<Users><User guid="${uuid()}" id="1" name="${esc(project.coderName || 'User')}"/></Users>` +
    codebook +
    `<Sources>${textSources}${pictureSources}</Sources>` +
    `</Project>`;

  return {
    fileName: `${sanitizeFileName(project.name)}.qdpx`,
    qdeXml,
    sourceFiles: files,
    sourceBytes: bytes
  };
}