import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import type { PDFDocumentProxy, TextContent } from 'pdfjs-dist/types/src/display/api';
import { collectMappedNodes, mapFormattedText, MappedNode, originalBytes, TextMapping } from '../lib/formattedMapping';
import { hashSourceText } from '../lib/sourceOriginal';
import { decorateMappedText, FormattedProps, useMappedInteractions } from './formattedCoding';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
interface PageText { content: TextContent; start: number; end: number }

export default function PdfDocumentView(props: FormattedProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null), [page, setPage] = useState(1), [zoomChoice, setZoomChoice] = useState<number | 'fit'>('fit');
  const [availableWidth, setAvailableWidth] = useState(612), [pageWidth, setPageWidth] = useState(612);
  const host = useRef<HTMLDivElement>(null);
  const zoom = zoomChoice === 'fit' ? Math.min(1.5, Math.max(.1, availableWidth / pageWidth)) : zoomChoice;
  const [mode, setMode] = useState<'text' | 'region'>('text'), [loading, setLoading] = useState(true), [error, setError] = useState(''), [warning, setWarning] = useState('');
  const [ready, setReady] = useState(0), [size, setSize] = useState({ width: 0, height: 0 });
  const [originalHash, setOriginalHash] = useState('');
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), sheet = useRef<HTMLDivElement>(null);
  const pages = useRef<PageText[]>([]), fullMapping = useRef<TextMapping | null>(null);
  const rawHtml = useRef(''), indexed = useRef<{ nodes: MappedNode[]; mapping: TextMapping } | null>(null);
  const linkedImage = props.images?.find(i => i.pdfPage?.docId === props.doc.id && i.pdfPage.page === page && i.pdfPage.originalHash === originalHash);
  const regions = props.regions?.filter(r => r.imageId === linkedImage?.id) || [];
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(() => setAvailableWidth(Math.max(100, host.current!.clientWidth - 4)));
    observer.observe(host.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ data: originalBytes(props.doc.original!.base64), isEvalSupported: false });
    setLoading(true); setError(''); setPdf(null); pages.current = []; indexed.current = null; setPage(1);
    (async () => {
      const document = await task.promise;
      let text = ''; const collected: PageText[] = [];
      for (let i = 1; i <= document.numPages; i++) {
        if (cancelled) return;
        const source = await document.getPage(i);
        const content = await source.getTextContent();
        const start = text.length;
        text += content.items.map(item => 'str' in item ? item.str : '').join('');
        collected.push({ content, start, end: text.length });
        source.cleanup();
      }
      if (cancelled) return;
      const hash = await hashSourceText(props.doc.original!.base64);
      if (cancelled) return;
      setOriginalHash(hash); pages.current = collected; fullMapping.current = mapFormattedText(props.doc.content, text); setPdf(document);
    })().catch(e => { if (!cancelled) { setError(`Could not display the PDF: ${e.message || e}`); setLoading(false); } });
    return () => { cancelled = true; task.destroy().catch(() => {}); };
  }, [props.doc.id, props.doc.original?.base64, props.doc.content]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let rendering: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    let textRendering: ReturnType<typeof pdfjs.renderTextLayer> | undefined;
    setLoading(true); indexed.current = null; setBox(null); setWarning('');
    props.onSelectionChange(null); props.onPdfRegion?.(null);
    (async () => {
      const source = await pdf.getPage(page);
      if (cancelled || !canvas.current || !root.current) return;
      const viewport = source.getViewport({ scale: zoom });
      setPageWidth(source.getViewport({ scale: 1 }).width);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.current.width = Math.ceil(viewport.width * ratio); canvas.current.height = Math.ceil(viewport.height * ratio);
      canvas.current.style.width = `${viewport.width}px`; canvas.current.style.height = `${viewport.height}px`;
      setSize({ width: viewport.width, height: viewport.height });
      root.current.replaceChildren(); root.current.style.setProperty('--scale-factor', String(zoom));
      rendering = source.render({ canvasContext: canvas.current.getContext('2d')!, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      await rendering.promise;
      if (cancelled) return;
      textRendering = pdfjs.renderTextLayer({ textContentSource: pages.current[page - 1].content, container: root.current, viewport });
      await textRendering.promise;
      if (cancelled) return;
      rawHtml.current = root.current.innerHTML;
      setLoading(false); setReady(v => v + 1);
    })().catch(e => { if (!cancelled && e.name !== 'RenderingCancelledException') { setError(`PDF page could not be rendered: ${e.message || e}`); setLoading(false); } });
    return () => { cancelled = true; rendering?.cancel(); textRendering?.cancel(); };
  }, [pdf, page, zoom]);

  useEffect(() => {
    if (!root.current || !fullMapping.current || loading || !pages.current[page - 1]) return;
    root.current.innerHTML = rawHtml.current;
    const pageText = pages.current[page - 1];
    const mapping: TextMapping = { ...fullMapping.current, rendered: fullMapping.current.rendered.slice(pageText.start, pageText.end), offsets: fullMapping.current.offsets.slice(pageText.start, pageText.end) };
    const collected = collectMappedNodes(root.current, () => true);
    // PDF.js' transparent text layer keeps the exact item order used above.
    if (collected.text !== mapping.rendered) { setWarning('PDF text order could not be matched. Use Plain text or Region coding.'); indexed.current = null; return; }
    decorateMappedText(root.current, collected.nodes, mapping, props);
    indexed.current = { nodes: collectMappedNodes(root.current, () => true).nodes, mapping };
  }, [ready, loading, props.segments, props.annotations, props.codesById, props.highlightRange]);
  useMappedInteractions(root, indexed, props, ready, setWarning);

  useEffect(() => {
    const segment = props.segments.find(s => s.id === props.scrollToSegmentId);
    const start = segment?.start ?? props.highlightRange?.start;
    const mapping = fullMapping.current;
    if (start === undefined || !mapping || !pdf) return;
    const offset = mapping.offsets.findIndex(value => value >= start);
    const targetPage = pages.current.findIndex(p => offset >= p.start && offset < p.end);
    if (targetPage >= 0) setPage(targetPage + 1);
  }, [pdf, props.scrollToSegmentId, props.scrollNonce, props.highlightNonce]);

  useEffect(() => { setBox(null); }, [props.regions]);
  function point(e: { clientX: number; clientY: number }) {
    const rect = sheet.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  }
  function rectangle(start: { x: number; y: number }, end: { x: number; y: number }) {
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  }
  return <div className="formatted-document pdf-document" ref={host}>
    <div className="formatted-toolbar">
      <button type="button" disabled={!pdf || page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
      <label>Page <select aria-label="PDF page" value={page} onChange={e => setPage(Number(e.target.value))}>{Array.from({ length: pdf?.numPages || 1 }, (_, i) => <option value={i + 1} key={i}>{i + 1}</option>)}</select> / {pdf?.numPages || '…'}</label>
      <button type="button" disabled={!pdf || page === pdf.numPages} onClick={() => setPage(p => p + 1)}>Next</button>
      <label>Zoom <select aria-label="PDF zoom" value={zoomChoice} onChange={e => setZoomChoice(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}><option value="fit">Fit width</option>{[.5, .75, 1, 1.25, 1.5, 2].map(z => <option key={z} value={z}>{z * 100}%</option>)}</select></label>
      <button type="button" aria-pressed={mode === 'text'} onClick={() => { setMode('text'); setBox(null); props.onPdfRegion?.(null); }}>Text</button>
      <button type="button" aria-pressed={mode === 'region'} onClick={() => { setMode('region'); props.onSelectionChange(null); window.getSelection()?.removeAllRanges(); }}>Region</button>
    </div>
    {loading && <p role="status">Opening PDF page…</p>}
    {error && <p role="alert">{error} Choose Plain text to continue.</p>}
    {(warning || props.doc.original?.textChanged) && <p className="formatted-warning" role="status">{warning || 'Coding text differs from this original. Use Plain text for text coding; page regions remain available.'}</p>}
    {!loading && !pages.current[page - 1]?.content.items.some(i => 'str' in i && i.str.trim()) && <p className="formatted-warning">This page has no selectable text. Use Region, or code the OCR text in Plain text.</p>}
    {box && <p role="status">Region selected on page {page} — click a code to apply it.</p>}
    <div className="pdf-sheet" ref={sheet} style={{ width: size.width, height: size.height, visibility: error ? 'hidden' : 'visible' }}>
      <canvas ref={canvas} aria-label={`PDF page ${page}`} />
      <div ref={root} className="pdf-text-layer" style={{ pointerEvents: mode === 'text' ? 'auto' : 'none' }}
        onDragOver={e => { if (e.dataTransfer.types.includes('text/plain')) e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); props.onDropCode?.(e.dataTransfer.getData('text/plain')); }} />
      <div className="pdf-region-layer" style={{ pointerEvents: mode === 'region' && !loading ? 'auto' : 'none' }}
        onPointerDown={e => { if (e.button !== 0) return; drag.current = point(e); setBox(null); props.onPdfRegion?.(null); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (drag.current) setBox(rectangle(drag.current, point(e))); }}
        onPointerCancel={() => { drag.current = null; setBox(null); }}
        onPointerUp={e => {
          if (!drag.current) return;
          const region = rectangle(drag.current, point(e)); drag.current = null;
          if (region.width < .005 || region.height < .005 || !canvas.current) { setBox(null); return; }
          setBox(region);
          props.onPdfRegion?.({ ...region, docId: props.doc.id, page, originalHash, dataUrl: canvas.current.toDataURL('image/png') });
        }}
        onClick={e => {
          if (box) return;
          const p = point(e), hits = regions.filter(r => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height);
          if (hits.length) props.onClickRegions?.(hits, e.clientX, e.clientY);
        }}>
        {regions.map(r => <div className="pdf-region-mark" key={r.id} title={props.codesById.get(r.codeId)?.name} style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%`, borderColor: props.codesById.get(r.codeId)?.color || '#facc15', background: (props.codesById.get(r.codeId)?.color || '#facc15') + '33' }} />)}
        {box && <div className="pdf-region-pending" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} />}
      </div>
    </div>
  </div>;
}
