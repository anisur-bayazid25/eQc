import React, { useEffect, useRef, useState } from 'react';
import { collectMappedNodes, mapFormattedText, MappedNode, originalBytes, TextMapping } from '../lib/formattedMapping';
import { deferPanel } from './DeferredPanel';
const PdfDocumentView=deferPanel(()=>import('./PdfDocumentView'),'PDF');
import { hashSourceText } from '../lib/sourceOriginal';

export type { PdfRegionSelection } from './formattedCoding';
import { decorateMappedText, FormattedProps, useMappedInteractions } from './formattedCoding';

function WordDocumentView(props: FormattedProps) {
  const root = useRef<HTMLDivElement>(null), styles = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const indexed = useRef<{ nodes: MappedNode[]; mapping: TextMapping } | null>(null);
  const [ready, setReady] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState(''), [warning, setWarning] = useState('');
  const [zoom, setZoom] = useState<number | 'fit'>('fit'), [fitZoom, setFitZoom] = useState(1);
  const raw = useRef<{ html: string; text: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const host = document.createElement('div'), css = document.createElement('div');
    raw.current = null; indexed.current = null; setLoading(true); setError('');
    (async () => {
      const { renderAsync } = await import('docx-preview');
      // External relationships and HTML altChunks are not needed for local viewing.
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(originalBytes(props.doc.original!.base64));
      for (const name of Object.keys(zip.files).filter(n => n.endsWith('.rels'))) {
        const xml = new DOMParser().parseFromString(await zip.file(name)!.async('string'), 'application/xml');
        for (const rel of Array.from(xml.getElementsByTagName('Relationship'))) if (rel.getAttribute('TargetMode') === 'External') rel.remove();
        zip.file(name, new XMLSerializer().serializeToString(xml));
      }
      await renderAsync(await zip.generateAsync({ type: 'uint8array' }), host, css, {
        className: 'eqc-word', useBase64URL: true, renderAltChunks: false, renderComments: false,
        ignoreLastRenderedPageBreak: false, renderChanges: false
      });
      for (const anchor of Array.from(host.querySelectorAll('a'))) { anchor.removeAttribute('href'); anchor.removeAttribute('target'); }
      for (const el of Array.from(host.querySelectorAll('header, footer, sup, .eqc-word-footnotes, .eqc-word-endnotes'))) el.setAttribute('data-view-only', 'true');
      if (cancelled || !root.current || !styles.current) return;
      styles.current.replaceChildren(...Array.from(css.childNodes));
      root.current.replaceChildren(...Array.from(host.childNodes));
      const collected = collectMappedNodes(root.current, node => !!node.parentElement?.closest('article') && !node.parentElement?.closest('[data-view-only]'));
      raw.current = { html: root.current.innerHTML, text: collected.text };
      setLoading(false); setReady(v => v + 1);
    })().catch(e => { if (!cancelled) { setError(`Could not display the Word original: ${e.message || e}`); setLoading(false); } });
    return () => { cancelled = true; };
  }, [props.doc.id, props.doc.original?.base64]);
  useEffect(() => {
    if (!raw.current || !root.current) return;
    root.current.innerHTML = raw.current.html;
    const accepts = (node: Text) => !!node.parentElement?.closest('article') && !node.parentElement?.closest('[data-view-only]');
    const collected = collectMappedNodes(root.current, accepts);
    const previous = indexed.current?.mapping;
    const mapping = previous?.canonical === props.doc.content && previous.rendered === collected.text ? previous : mapFormattedText(props.doc.content, collected.text);
    decorateMappedText(root.current, collected.nodes, mapping, props);
    indexed.current = { nodes: collectMappedNodes(root.current, accepts).nodes, mapping };
    // This revision also tells navigation that the new marks have mounted.
  }, [ready, props.doc.content, props.segments, props.annotations, props.highlightRange, props.codesById]);
  useMappedInteractions(root, indexed, props, ready, setWarning);
  useEffect(() => {
    if (!host.current || !root.current) return;
    const fit = () => {
      const width = Math.max(0, ...Array.from(root.current!.querySelectorAll<HTMLElement>('section.eqc-word')).map(el => el.offsetWidth)) + 32;
      if (width > 32) setFitZoom(Math.min(1, Math.max(.1, host.current!.clientWidth / width)));
    };
    const observer = new ResizeObserver(fit); observer.observe(host.current); fit();
    return () => observer.disconnect();
  }, [ready]);
  useEffect(() => {
    const target = root.current?.querySelector<HTMLElement>('[data-search-match]') || (props.scrollToSegmentId && Array.from(root.current?.querySelectorAll<HTMLElement>('[data-seg-ids]') || []).find(el => el.dataset.segIds?.split(' ').includes(props.scrollToSegmentId!)));
    target && target.scrollIntoView({ block: 'center' });
  }, [ready, props.scrollNonce, props.highlightNonce]);
  return <div className="formatted-document" ref={host}>
    <div className="formatted-toolbar"><span>Word view</span><label>Zoom <select aria-label="Word zoom" value={zoom} onChange={e => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}><option value="fit">Fit width</option>{[.5, .75, 1, 1.25, 1.5, 2].map(z => <option key={z} value={z}>{z * 100}%</option>)}</select></label><small>Word pagination may differ. Source formatting is retained.</small></div>
    {loading && <p role="status">Opening Word document…</p>}
    {error && <p role="alert">{error} Choose Plain text to continue coding.</p>}
    {(warning || props.doc.original?.textChanged) && <p className="formatted-warning" role="status">{warning || 'Coding text differs from this original. Use Plain text for text coding.'}</p>}
    <div ref={styles} className="word-styles" aria-hidden="true" />
    <div ref={root} className="word-document-body" style={{ zoom: zoom === 'fit' ? fitZoom : zoom } as React.CSSProperties}
      onDragOver={e => { if (e.dataTransfer.types.includes('text/plain')) e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); props.onDropCode?.(e.dataTransfer.getData('text/plain')); }} />
  </div>;
}

export default function FormattedDocView(props: FormattedProps) {
  const [validated, setValidated] = useState<{ content: string; hash: string; matches: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    hashSourceText(props.doc.content).then(hash => {
      if (!cancelled) setValidated({ content: props.doc.content, hash: props.doc.original!.textHash, matches: hash === props.doc.original!.textHash });
    }).catch(() => { if (!cancelled) setValidated({ content: props.doc.content, hash: props.doc.original!.textHash, matches: false }); });
    return () => { cancelled = true; };
  }, [props.doc.content, props.doc.original?.textHash]);
  if (!validated || validated.content !== props.doc.content || validated.hash !== props.doc.original?.textHash) return <p role="status">Checking source text…</p>;
  const checkedProps = { ...props, doc: { ...props.doc, original: { ...props.doc.original!, textChanged: props.doc.original?.textChanged || !validated.matches } } };
  return props.doc.original?.format === 'pdf' ? <PdfDocumentView {...checkedProps} /> : <WordDocumentView {...checkedProps} />;
}
