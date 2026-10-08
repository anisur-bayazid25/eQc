import React, { useEffect, useState } from 'react';
import { Project } from '../domain';
import { projectForExport } from '../lib/projectExport';
import { buildQdpxExport } from '../lib/qdpxExport';

export default function ProjectExportDialog({ project, onClose, onMessage }: { project: Project; onClose: () => void; onMessage: (message: string) => void }) {
  const [format, setFormat] = useState('json'), [originals, setOriginals] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; return () => previous?.focus(); }, []);
  return <div className="research-overlay" onKeyDown={e => {
    if (e.key === 'Escape' && !busy) onClose();
    if (e.key === 'Tab') {
      const fields = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('select:not(:disabled), button:not(:disabled)'));
      const first = fields[0], last = fields[fields.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}><section className="project-export-dialog" role="dialog" aria-modal="true" aria-labelledby="project-export-title">
    <h2 id="project-export-title">Export project</h2>
    <label>File format<select autoFocus aria-label="Project export format" value={format} onChange={e => setFormat(e.target.value)}><option value="json">JSON — eQc backup</option><option value="qdpx">QDPX — REFI-QDA exchange</option></select></label>
    <label>Documents<select aria-label="Export document contents" value={originals ? 'originals' : 'text'} onChange={e => setOriginals(e.target.value === 'originals')}><option value="originals">Original documents and coding text</option><option value="text">Plain text only — smaller file</option></select></label>
    <p>{originals ? 'Retains attached Word and PDF files alongside coding text.' : 'Omits attached Word and PDF files. Keeps coding text, codes, memos, cases and image coding, including PDF page snapshots.'}</p>
    <p className="section-hint">JSON restores the eQc project. QDPX exchanges sources and coding with compatible applications; advanced research records are carried as notes. Local recovery history is stored on this computer.</p>
    {error && <p role="alert">{error}</p>}
    <div className="research-actions"><button disabled={busy} className="primary-btn" onClick={async () => { setBusy(true); setError(''); try { const data = projectForExport(project, originals); const saved = format === 'json' ? await window.qv.exportBackup(data) : await window.qv.exportQdpx(await buildQdpxExport(data)); if (saved) { onMessage(`Project exported to ${saved}`); onClose(); } } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }}>{busy ? 'Exporting…' : 'Export project'}</button><button disabled={busy} onClick={onClose}>Cancel</button></div>
  </section></div>;
}
