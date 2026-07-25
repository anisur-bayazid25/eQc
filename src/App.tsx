import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Project, ProjectSummary, Folder, SourceDoc, Code, CodedSegment, FrameworkCell,
  ID, uid, newProject, randomColor, childCodes, descendantCodeIds
} from './domain';
import CodeTree from './components/CodeTree';
import CodeSearch from './components/CodeSearch';
import DocTree, { SortKey } from './components/DocTree';
import DocEditor from './components/DocEditor';
import { getSelectionOffsets, SelectionOffsets } from './lib/textOffsets';
import { relocateSegmentsAfterEdit } from './lib/relocateSegments';
import { importCsvDataset } from './lib/csvImport';
import { importQdpx } from './lib/qdpxImport';
import { mergeProjectInto } from './lib/merge';
import { codingFrequency, codeDocumentMatrix, codeCooccurrenceMatrix } from './lib/analysis';
import { buildReportHtml } from './lib/report';
import { AUTO_CODE_LANGUAGES, CaptureBoundary, runAutoCode } from './lib/autoCode';
import { useTextPrompt } from './components/PromptModal';
import { extractBengaliTextFromPDF } from './lib/pdfExtractor';
import { buildScopedExport, buildCodebookOutline, ExportScope, SCOPE_LABELS } from './lib/exportBuilders';
import pkg from '../package.json';

type Tab = 'workspace' | 'codebook' | 'autocode' | 'analysis' | 'about';

function flattenCodes(codes: Code[]): Array<{ code: Code; depth: number }> {
  const out: Array<{ code: Code; depth: number }> = [];
  function walk(parentId: ID | null, depth: number) {
    for (const c of childCodes(codes, parentId)) {
      out.push({ code: c, depth });
      walk(c.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

type FreqSortKey =
  | 'countDesc' | 'countAsc'
  | 'nameAsc' | 'nameDesc'
  | 'groupedNameAsc' | 'groupedNameDesc'
  | 'groupedCountDesc' | 'groupedCountAsc';

function sortFrequencyTree(
  project: Project,
  sortKey: FreqSortKey
): Array<{ code: Code; depth: number; ownCount: number; rolledUpCount: number; hasChildren: boolean }> {
  const ownCountByCode = new Map<ID, number>();
  for (const seg of project.codedSegments) {
    ownCountByCode.set(seg.codeId, (ownCountByCode.get(seg.codeId) || 0) + 1);
  }
  const rolledUp = (codeId: ID) => {
    let total = 0;
    descendantCodeIds(project.codes, codeId).forEach(id => { total += ownCountByCode.get(id) || 0; });
    return total;
  };
  const toRow = (code: Code, depth: number) => ({
    code,
    depth,
    ownCount: ownCountByCode.get(code.id) || 0,
    rolledUpCount: rolledUp(code.id),
    hasChildren: childCodes(project.codes, code.id).length > 0
  });

  // "Flat" sorts ignore hierarchy entirely — every code, one level, ranked
  // purely by the chosen criterion. Good for "what's my single most-coded
  // category regardless of where it sits in the tree".
  if (!sortKey.startsWith('grouped')) {
    const rows = project.codes.map(c => toRow(c, 0));
    switch (sortKey) {
      case 'countDesc': return rows.sort((a, b) => b.rolledUpCount - a.rolledUpCount);
      case 'countAsc': return rows.sort((a, b) => a.rolledUpCount - b.rolledUpCount);
      case 'nameAsc': return rows.sort((a, b) => a.code.name.localeCompare(b.code.name));
      case 'nameDesc': return rows.sort((a, b) => b.code.name.localeCompare(a.code.name));
      default: return rows;
    }
  }

  // "Grouped" sorts keep the parent/child nesting, but order siblings
  // within each level by the chosen criterion.
  const rows: Array<{ code: Code; depth: number; ownCount: number; rolledUpCount: number; hasChildren: boolean }> = [];
  function orderSiblings(codes: Code[]): Code[] {
    const copy = [...codes];
    switch (sortKey) {
      case 'groupedNameAsc': return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'groupedNameDesc': return copy.sort((a, b) => b.name.localeCompare(a.name));
      case 'groupedCountDesc': return copy.sort((a, b) => rolledUp(b.id) - rolledUp(a.id));
      case 'groupedCountAsc': return copy.sort((a, b) => rolledUp(a.id) - rolledUp(b.id));
      default: return copy;
    }
  }
  function walk(parentId: ID | null, depth: number) {
    for (const code of orderSiblings(childCodes(project.codes, parentId))) {
      rows.push(toRow(code, depth));
      walk(code.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}

// Small CSV helper reused by every per-view analysis export below.
function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}

export type ReaderTheme = 'paperwhite' | 'white' | 'dark';

const THEME_STYLES: Record<ReaderTheme, React.CSSProperties> = {
  paperwhite: {
      backgroundColor: '#f8f1e3', // Paperwhite/Warm e-reader tan
    color: '#3c3226',           // Deep warm brown text  

  },
  white: {
    backgroundColor: '#ffffff', // Clean crisp white
    color: '#0f172a',           // Dark charcoal text
  },
  dark: {
    backgroundColor: '#0f172a', // Current dark background
    color: '#f8fafc',           // High-contrast white text
  },
};

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<Tab>('workspace');
  const [toast, setToast] = useState<string | null>(null);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>(() => {
    return (localStorage.getItem('qda-reader-theme') as ReaderTheme) || 'paperwhite';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(
  () => (localStorage.getItem('qv-theme') as 'dark' | 'light') || 'dark'
);
  const [showDocNotes, setShowDocNotes] = useState(false);
  const [docNotesDraft, setDocNotesDraft] = useState('');
  const [editingNoteFor, setEditingNoteFor] = useState<ID | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('qv-theme', theme);
}, [theme]);

  React.useEffect(() => {
    localStorage.setItem('qda-reader-theme', readerTheme);
  }, [readerTheme]);

  // Workspace state
  const [selectedDocId, setSelectedDocId] = useState<ID | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [pendingSelection, setPendingSelection] = useState<SelectionOffsets | null>(null);
  const [segmentPopup, setSegmentPopup] = useState<{ segments: CodedSegment[]; x: number; y: number } | null>(null);
  const [editingDocId, setEditingDocId] = useState<ID | null>(null);
  const [draftContent, setDraftContent] = useState('');

  // Undo / redo history (per project, in-memory only)
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const HISTORY_LIMIT = 50;

  // Codebook state
  const [codebookSelectedCodeId, setCodebookSelectedCodeId] = useState<ID | null>(null);
  const [workspaceCodeSearch, setWorkspaceCodeSearch] = useState('');
  const [codebookCodeSearch, setCodebookCodeSearch] = useState('');
  const [exportScope, setExportScope] = useState<ExportScope>('codesExcerptsSummaries');

  // Auto-code state
  const [acKeyword, setAcKeyword] = useState('');
  const [acBoundary, setAcBoundary] = useState<CaptureBoundary>('exact');
  const [acLanguage, setAcLanguage] = useState('en');
  const [acTargetCodeId, setAcTargetCodeId] = useState<ID | ''>('');
  const [acResult, setAcResult] = useState<string | null>(null);

  const { prompt, modal: promptModal } = useTextPrompt();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), 3500);
  }, []);

  // ---------------------------------------------------------------
  // Load project list on mount; open the most recent project, or
  // create a fresh one if this is the first launch.
  // ---------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const list = await window.qv.listProjects();
      setProjects(list);
      if (list.length > 0) {
        const p = await window.qv.loadProject(list[0].id);
        setProject(p);
      } else {
        const p = newProject('My Project');
        await window.qv.saveProject(p);
        setProjects([{ id: p.id, name: p.name, createdAt: p.createdAt }]);
        setProject(p);
      }
    })();
  }, []);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const saveToDisk = useCallback((p: Project) => {
    setSaveStatus('saving');
    return window.qv.saveProject(p).then(() => {
      setSaveStatus('saved');
      setProjects(prev => {
        const others = prev.filter(x => x.id !== p.id);
        return [{ id: p.id, name: p.name, createdAt: p.createdAt }, ...others];
      });
    }).catch(err => {
      setSaveStatus('error');
      showToast(`Save failed: ${err}`);
      throw err;
    });
  }, [showToast]);

  const persist = useCallback((next: Project) => {
    setProject(prevProj => {
      if (prevProj && prevProj.id === next.id) {
        setPast(p => {
          const updated = [...p, prevProj];
          return updated.length > HISTORY_LIMIT ? updated.slice(updated.length - HISTORY_LIMIT) : updated;
        });
        setFuture([]);
      }
      return next;
    });
    saveToDisk(next).catch(() => {});
  }, [saveToDisk]);

  function manualSave() {
    if (!project) return;
    saveToDisk(project).catch(() => {});
  }

  // Reset undo/redo history whenever the active project changes (undo/redo
  // themselves never change project.id, so this only fires on a genuine
  // switch/create/import — not as a side effect of undoing/redoing).
  useEffect(() => {
    setPast([]);
    setFuture([]);
  }, [project?.id]);

  function undo() {
    if (past.length === 0 || !project) return;
    const previous = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [project, ...f].slice(0, HISTORY_LIMIT));
    setProject(previous);
    saveToDisk(previous).catch(() => {});
  }

  function redo() {
    if (future.length === 0 || !project) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, project].slice(-HISTORY_LIMIT));
    setProject(next);
    saveToDisk(next).catch(() => {});
  }

  // Ctrl+Z to undo, Ctrl+Shift+Z or Ctrl+Y to redo (Cmd on macOS).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTextField = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (isTextField) return; // let the field handle its own native undo/redo
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [past, future, project]);

  

  const codesById = useMemo(() => {
    const m = new Map<string, Code>();
    project?.codes.forEach(c => m.set(c.id, c));
    return m;
  }, [project?.codes]);

  const selectedDoc = useMemo(
    () => project?.docs.find(d => d.id === selectedDocId) || null,
    [project?.docs, selectedDocId]
  );

  const codedCountForDoc = useCallback(
    (docId: ID) => project?.codedSegments.filter(s => s.docId === docId).length || 0,
    [project?.codedSegments]
  );

useEffect(() => {
    setDocNotesDraft(selectedDoc?.notes || '');
    setShowDocNotes(false);
  }, [selectedDoc?.id]);

  useEffect(() => {
    setEditingNoteFor(null);
    setNoteDraft('');
  }, [segmentPopup]);

  // =================================================================
  // Project management
  // =================================================================
  async function handleNewProject() {
    const name = await prompt('New project name', 'Untitled Project', 'Create');
    if (!name) return;
    const p = newProject(name);
    await saveToDisk(p).catch(() => {});
    setProject(p);
    setSelectedDocId(null);
  }

  async function handleSwitchProject(id: ID) {
    const p = await window.qv.loadProject(id);
    if (p) {
      setProject(p);
      setSelectedDocId(null);
      setCodebookSelectedCodeId(null);
    }
  }

  async function handleRenameProject() {
    if (!project) return;
    const name = await prompt('Rename project', project.name, 'Rename');
    if (!name) return;
    persist({ ...project, name });
  }

  async function handleExportBackup() {
    if (!project) return;
    const path = await window.qv.exportBackup(project);
    if (path) showToast(`Backup exported to ${path}`);
  }

  async function handleImportBackup() {
    const data = await window.qv.importBackup();
    if (!data) return;
    const imported: Project = { ...data, id: uid('proj'), name: `${data.name} (imported)` };
    await saveToDisk(imported).catch(() => {});
    setProject(imported);
    showToast('Project imported.');
  }

  async function handleMerge() {
    if (!project) return;
    const sources = await window.qv.pickMultipleForMerge();
    if (sources.length === 0) return;
    let next = { ...project, folders: [...project.folders], docs: [...project.docs], codes: [...project.codes], codedSegments: [...project.codedSegments] };
    let totalDocs = 0, totalCodes = 0, totalSegs = 0;
    for (const src of sources) {
      const summary = mergeProjectInto(next, src);
      totalDocs += summary.docsAdded;
      totalCodes += summary.codesAdded;
      totalSegs += summary.segmentsAdded;
    }
    persist(next);
    showToast(`Merged ${sources.length} file(s): +${totalDocs} docs, +${totalCodes} codes, +${totalSegs} coded passages.`);
  }

  // =================================================================
  // Folders / documents
  // =================================================================
  async function addRootFolder() {
    if (!project) return;
    const name = await prompt('New root folder', '', 'Create');
    if (!name) return;
    const folder: Folder = { id: uid('folder'), name, parentId: null };
    persist({ ...project, folders: [...project.folders, folder] });
  }

  async function addSubfolder(parentId: ID) {
    if (!project) return;
    const name = await prompt('New subfolder', '', 'Create');
    if (!name) return;
    const folder: Folder = { id: uid('folder'), name, parentId };
    persist({ ...project, folders: [...project.folders, folder] });
  }

  async function renameFolder(folder: Folder) {
    if (!project) return;
    const name = await prompt('Rename folder', folder.name, 'Rename');
    if (!name) return;
    persist({ ...project, folders: project.folders.map(f => (f.id === folder.id ? { ...f, name } : f)) });
  }

  function deleteFolder(folder: Folder) {
    if (!project) return;
    if (!window.confirm(`Delete folder "${folder.name}"? Documents inside will move to the root level.`)) return;
    const folders = project.folders.filter(f => f.id !== folder.id);
    const docs = project.docs.map(d => (d.folderId === folder.id ? { ...d, folderId: null } : d));
    persist({ ...project, folders, docs });
  }

  async function addDocs(folderId: ID | null) {
    if (!project) return;
    const files = await window.qv.pickAndExtractDocs();
    if (files.length === 0) return;
    const newDocs: SourceDoc[] = [];
    const failures: string[] = [];
    for (const f of files) {
      if (!f.ok) {
        failures.push(`${f.name}: ${f.error}`);
        continue;
      }
      newDocs.push({
        id: uid('doc'),
        folderId,
        name: f.name,
        content: f.content,
        addedAt: Date.now(),
        sizeBytes: f.sizeBytes
      });
    }
    if (newDocs.length > 0) {
      persist({ ...project, docs: [...project.docs, ...newDocs] });
      setSelectedDocId(newDocs[0].id);
    }
    if (failures.length > 0) showToast(`Some files could not be imported: ${failures.join('; ')}`);
  }

async function addScannedPdf(folderId: ID | null) {
    if (!project) return;
    
    // Create an invisible file input to grab the raw File object in the browser
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.multiple = true;
    
    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const newDocs: SourceDoc[] = [];
      const failures: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        
        try {
          // Send progress messages directly to your UI's showToast banner
          const content = await extractBengaliTextFromPDF(f, (message) => {
            // Converts "Reading page 1 of 11..." to "Scanning page 1 of 11..."
            const statusMsg = message.replace(/^Reading/i, 'Scanning');
            showToast(`[${f.name}] ${statusMsg}`);
          });
          
          newDocs.push({
            id: uid('doc'),
            folderId,
            name: f.name,
            content: content,
            addedAt: Date.now(),
            sizeBytes: f.size
          });
        } catch (error: any) {
          failures.push(`${f.name}: ${error.message || 'OCR failed'}`);
        }
      }

      if (newDocs.length > 0) {
        persist({ ...project, docs: [...project.docs, ...newDocs] });
        setSelectedDocId(newDocs[0].id);
        // Final completion message shown on screen
        showToast('PDF scan complete!');
      }
      if (failures.length > 0) showToast(`Some files failed: ${failures.join('; ')}`);
    };

    input.click(); // Trigger the file picker
  }


  async function renameDoc(doc: SourceDoc) {
    if (!project) return;
    const name = await prompt('Rename document', doc.name, 'Rename');
    if (!name) return;
    persist({ ...project, docs: project.docs.map(d => (d.id === doc.id ? { ...d, name } : d)) });
  }

  function deleteDoc(doc: SourceDoc) {
    if (!project) return;
    if (!window.confirm(`Delete document "${doc.name}"? Its coded passages will also be removed.`)) return;
    const docs = project.docs.filter(d => d.id !== doc.id);
    const codedSegments = project.codedSegments.filter(s => s.docId !== doc.id);
    persist({ ...project, docs, codedSegments });
    if (selectedDocId === doc.id) setSelectedDocId(null);
  }

  function startEditDoc(doc: SourceDoc) {
    setPendingSelection(null);
    setSegmentPopup(null);
    setDraftContent(doc.content);
    setEditingDocId(doc.id);
  }

  function cancelEditDoc() {
    setEditingDocId(null);
    setDraftContent('');
  }

  function saveEditDoc() {
    if (!project || !editingDocId) return;
    const doc = project.docs.find(d => d.id === editingDocId);
    if (!doc) return;

    const docSegs = project.codedSegments.filter(s => s.docId === editingDocId);
    const { segments: relocated, keptCount, droppedCount } = relocateSegmentsAfterEdit(doc.content, draftContent, docSegs);

    const docs = project.docs.map(d =>
      d.id === editingDocId ? { ...d, content: draftContent, sizeBytes: draftContent.length } : d
    );
    const codedSegments = [
      ...project.codedSegments.filter(s => s.docId !== editingDocId),
      ...relocated
    ];
    persist({ ...project, docs, codedSegments });
    setEditingDocId(null);
    setDraftContent('');

    if (docSegs.length > 0) {
      showToast(
        droppedCount > 0
          ? `Saved. ${keptCount} coded passage(s) re-matched; ${droppedCount} could not be found in the edited text and were removed.`
          : `Saved. All ${keptCount} coded passage(s) re-matched successfully.`
      );
    } else {
      showToast('Document saved.');
    }
  }

async function handleExportDocDocx(doc: SourceDoc) {
  const path = await window.qv.exportDocAsDocx({ name: doc.name, content: doc.content });
  if (path) showToast(`Exported to ${path}`);
}

  // =================================================================
  // Codes
  // =================================================================
  async function addRootCode() {
    if (!project) return;
    const name = await prompt('New root code', '', 'Create');
    if (!name) return;
    const code: Code = { id: uid('code'), name, color: randomColor(project.codes.length), parentId: null, summary: '' };
    persist({ ...project, codes: [...project.codes, code] });
  }

  async function addSubcode(parentId: ID) {
    if (!project) return;
    const name = await prompt('New subcode', '', 'Create');
    if (!name) return;
    const code: Code = { id: uid('code'), name, color: randomColor(project.codes.length), parentId, summary: '' };
    persist({ ...project, codes: [...project.codes, code] });
  }

async function handleExportCsv() {
  if (!project) return;
  const { csv } = buildScopedExport(project, exportScope);
  const path = await window.qv.exportText({
    title: 'Export CSV',
    defaultName: `${project.name.replace(/[^\w\- ]/g, '_')}_${exportScope}.csv`,
    content: csv,
    extension: 'csv',
    filterName: 'CSV file'
  });
  if (path) showToast(`Exported to ${path}`);
}

async function handleExportDocx() {
  if (!project) return;
  if (exportScope === 'codesOnly') {
    const outline = buildCodebookOutline(project);
    const path = await window.qv.exportDocxTable({
      kind: 'outline',
      title: `${project.name} — Codebook`,
      outline,
      filenameBase: `${project.name}_codebook`
    });
    if (path) showToast(`Exported to ${path}`);
    return;
  }
  const { headers, rows } = buildScopedExport(project, exportScope);
  const path = await window.qv.exportDocxTable({
    kind: 'table',
    title: `${project.name} — ${SCOPE_LABELS[exportScope]}`,
    headers,
    rows,
    filenameBase: `${project.name}_${exportScope}`
  });
  if (path) showToast(`Exported to ${path}`);
}

  function updateCode(codeId: ID, patch: Partial<Code>) {
    if (!project) return;
    persist({ ...project, codes: project.codes.map(c => (c.id === codeId ? { ...c, ...patch } : c)) });
  }

  function deleteCode(code: Code) {
    if (!project) return;
    const idsToRemove = descendantCodeIds(project.codes, code.id);
    const label = idsToRemove.size > 1 ? `"${code.name}" and its ${idsToRemove.size - 1} subcode(s)` : `"${code.name}"`;
    if (!window.confirm(`Delete code ${label}? All coded passages using it will also be removed.`)) return;
    const codes = project.codes.filter(c => !idsToRemove.has(c.id));
    const codedSegments = project.codedSegments.filter(s => !idsToRemove.has(s.codeId));
    persist({ ...project, codes, codedSegments });
    if (codebookSelectedCodeId && idsToRemove.has(codebookSelectedCodeId)) setCodebookSelectedCodeId(null);
  }

function moveDoc(docId: ID, targetFolderId: ID | null) {
    if (!project) return;
    const docs = project.docs.map(d =>
      d.id === docId ? { ...d, folderId: targetFolderId } : d
    );
    persist({ ...project, docs });
  }

  function moveCode(codeId: ID, targetParentId: ID | null) {
    if (!project) return;
    
    // Prevent dropping on itself
    if (codeId === targetParentId) return; 
    
    // Prevent cyclical dependencies (dropping a code into its own subcode)
    if (targetParentId !== null) {
      const descendants = descendantCodeIds(project.codes, codeId);
      if (descendants.has(targetParentId)) {
        showToast("Cannot move a code into its own subcode.");
        return;
      }
    }

    const codes = project.codes.map(c =>
      c.id === codeId ? { ...c, parentId: targetParentId } : c
    );
    persist({ ...project, codes });
  }

  function pullChildSummaries(codeId: ID) {
    if (!project) return;
    const children = childCodes(project.codes, codeId);
    if (children.length === 0) {
      showToast('This code has no subcodes.');
      return;
    }
    const parent = project.codes.find(c => c.id === codeId);
    if (!parent) return;
    const additions = children
      .filter(c => c.summary.trim())
      .map(c => `— ${c.name} —\n${c.summary}`)
      .join('\n\n');
    if (!additions) {
      showToast('Subcodes have no summaries to pull yet.');
      return;
    }
    const merged = parent.summary ? `${parent.summary}\n\n${additions}` : additions;
    updateCode(codeId, { summary: merged });
  }

  // =================================================================
  // Manual coding (Workspace tab)
  // =================================================================
  function applyCodeToSelection(code: Code) {
    if (!project || !selectedDoc || !pendingSelection) return;
    const segment: CodedSegment = {
      id: uid('seg'),
      docId: selectedDoc.id,
      codeId: code.id,
      start: pendingSelection.start,
      end: pendingSelection.end,
      text: pendingSelection.text,
      createdAt: Date.now(),
      source: 'manual'
    };
    persist({ ...project, codedSegments: [...project.codedSegments, segment] });
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
    showToast(`Applied "${code.name}"`);
  }

  // Shared by the Code Legend tree and the code search box: apply to the
  // pending text selection if there is one, otherwise jump to that code's
  // detail view in the Codebook tab.
  function handleWorkspaceCodeClick(code: Code) {
    if (pendingSelection) {
      applyCodeToSelection(code);
    } else {
      setCodebookSelectedCodeId(code.id);
      setTab('codebook');
    }
  }

  function removeCodedSegment(segId: ID) {
    if (!project) return;
    persist({ ...project, codedSegments: project.codedSegments.filter(s => s.id !== segId) });
    setSegmentPopup(null);
  }

function updateSegmentNote(segId: ID, note: string) {
    if (!project) return;
    persist({
      ...project,
      codedSegments: project.codedSegments.map(s =>
        s.id === segId ? { ...s, note: note.trim() ? note.trim() : undefined } : s
      )
    });
  }

  function updateDocNotes(docId: ID, notes: string) {
    if (!project) return;
    persist({
      ...project,
      docs: project.docs.map(d =>
        d.id === docId ? { ...d, notes: notes.trim() ? notes.trim() : undefined } : d
      )
    });
  }

function updateFrameworkCell(docId: ID, codeId: ID, text: string) {
    if (!project) return;
    const cells = project.frameworkCells || [];
    const trimmed = text.trim();
    const existing = cells.find(c => c.docId === docId && c.codeId === codeId);

    let nextCells: FrameworkCell[];
    if (!trimmed) {
      nextCells = cells.filter(c => !(c.docId === docId && c.codeId === codeId));
    } else if (existing) {
      nextCells = cells.map(c =>
        c.docId === docId && c.codeId === codeId ? { ...c, text: trimmed, updatedAt: Date.now() } : c
      );
    } else {
      nextCells = [...cells, { id: uid('fw'), docId, codeId, text: trimmed, updatedAt: Date.now() }];
    }
    persist({ ...project, frameworkCells: nextCells });
  }

  const docSegments = useMemo(
    () => (selectedDoc ? project?.codedSegments.filter(s => s.docId === selectedDoc.id) || [] : []),
    [project?.codedSegments, selectedDoc]
  );

  // =================================================================
  // CSV dataset import (Codebook tab)
  // =================================================================
  async function handleCsvImport() {
    if (!project) return;
    const parsed = await window.qv.pickAndParseCsv();
    if (!parsed) return;
    try {
      const draft: Project = {
        ...project,
        folders: [...project.folders],
        docs: [...project.docs],
        codes: [...project.codes],
        codedSegments: [...project.codedSegments]
      };
      const summary = importCsvDataset(draft, parsed);
      persist(draft);
      showToast(
        `Imported ${parsed.fileName}: +${summary.docsCreated} docs, +${summary.codesCreated} codes, ` +
        `+${summary.segmentsCreated} coded passages` +
        (summary.segmentsNotFound ? ` (${summary.segmentsNotFound} quotes not matched in text)` : '')
      );
    } catch (e: any) {
      showToast(e.message || String(e));
    }
  }

// =================================================================
  // REFI-QDA (.qdpx) import (Codebook tab)
  // =================================================================
  async function handleQdpxImport() {
    if (!project) return;
    const payload = await window.qv.pickAndParseQdpx();
    if (!payload) return;
    try {
      const draft: Project = {
        ...project,
        folders: [...project.folders],
        docs: [...project.docs],
        codes: [...project.codes],
        codedSegments: [...project.codedSegments]
      };
      const summary = importQdpx(draft, payload);
      persist(draft);
      if (summary.sourcesSkipped.length > 0) {
        console.log('qdpx import — skipped non-text sources:', summary.sourcesSkipped);
      }
      showToast(
        `Imported ${payload.fileName}: +${summary.codesCreated} codes, +${summary.docsCreated} docs, ` +
        `+${summary.segmentsCreated} coded passages, ${summary.memosImported} memos` +
        (summary.segmentsSkipped ? ` (${summary.segmentsSkipped} selections skipped)` : '') +
        (summary.sourcesSkipped.length ? ` — ${summary.sourcesSkipped.length} non-text source(s) skipped (see console)` : '')
      );
    } catch (e: any) {
      showToast(e.message || String(e));
    }
  }

  // =================================================================
  // Auto-coder
  // =================================================================
  function runAutoCodeJob() {
    if (!project || !acTargetCodeId || !acKeyword.trim()) {
      showToast('Enter a keyword and choose a target code first.');
      return;
    }
    const newSegments: CodedSegment[] = [];
    let docsMatched = 0;
    for (const doc of project.docs) {
      const matches = runAutoCode(doc.content, acKeyword, acBoundary, acLanguage);
      if (matches.length > 0) docsMatched++;
      for (const m of matches) {
        const exists = project.codedSegments.some(
          s => s.docId === doc.id && s.codeId === acTargetCodeId && s.start === m.start && s.end === m.end
        );
        if (!exists) {
          newSegments.push({
            id: uid('seg'),
            docId: doc.id,
            codeId: acTargetCodeId,
            start: m.start,
            end: m.end,
            text: m.text,
            createdAt: Date.now(),
            source: 'auto-code'
          });
        }
      }
    }
    persist({ ...project, codedSegments: [...project.codedSegments, ...newSegments] });
    const msg = `Applied to ${newSegments.length} new segment(s) across ${docsMatched} document(s).`;
    setAcResult(msg);
    showToast(msg);
  }

  // =================================================================
  // Analysis / report
  // =================================================================
  async function handleExportReport() {
    if (!project) return;
    const html = buildReportHtml(project);
    const path = await window.qv.exportReport(project, html);
    if (path) showToast(`Report exported to ${path}`);
  }

  if (!project) {
    return (
      <div className="loading-screen">
        <img src="./eqc-logo.png" alt="eQc" className="loading-logo" />
        <div className="loading-title">eQc — Easy Qual Coding</div>
        <div className="loading-spinner" />
        <div className="loading-subtitle">Loading your projects…</div>
      </div>
    );
  }
  const flatCodes = flattenCodes(project.codes);
  const codebookCode = codebookSelectedCodeId ? codesById.get(codebookSelectedCodeId) || null : null;
  const codebookExcerpts = codebookCode
    ? project.codedSegments.filter(s => s.codeId === codebookCode.id)
    : [];

  return (
    <div className="app-shell">
      <header className="app-header">
        
        {/* Brand Logo & Name */}
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img 
            src="./eqc-logo.png" 
            alt="EQC Logo" 
            style={{ width: '30px', height: '30px', objectFit: 'contain' }} 
          />
          <span>eQc</span>
        </div>
        
        {/* Project Controls & Action Buttons */}
        <div className="project-controls">
          <select value={project.id} onChange={e => handleSwitchProject(e.target.value)}>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          <button className="icon-btn" title="New project" onClick={handleNewProject}>➕</button>
          <button className="icon-btn" title="Rename project" onClick={handleRenameProject}>✏️</button>
          <button className="icon-btn" title="Export backup (.json)" onClick={handleExportBackup}>⬇️ Export</button>
          <button className="icon-btn" title="Import backup (.json)" onClick={handleImportBackup}>⬆️ Import</button>
          <button className="icon-btn" title="Merge project(s) into current" onClick={handleMerge}>🔀 Merge</button>
          
          <span className="header-divider" />
          
          <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={past.length === 0} onClick={undo}>↶ Undo</button>
          <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={future.length === 0} onClick={redo}>↷ Redo</button>
          <button className="icon-btn" title="Toggle light/dark theme" onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          
          <span className="header-divider" />
          
          <button className="icon-btn" title="Save now" onClick={manualSave}>💾 Save</button>
          <span className={`save-status save-status-${saveStatus}`}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && '✓ Saved'}
            {saveStatus === 'error' && '⚠ Save failed'}
            {saveStatus === 'idle' && ''}
          </span>
        </div>

        {/* Main Navigation Tabs */}
        <nav className="tabs">
          {(['workspace', 'codebook', 'autocode', 'analysis', 'about'] as Tab[]).map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'workspace' && 'Workspace'}
              {t === 'codebook' && 'Codebook'}
              {t === 'autocode' && 'Auto-Code'}
              {t === 'analysis' && 'Analysis'}
              {t === 'about' && 'About'}
            </button>
          ))}
        </nav>
        
      </header>

      {tab === 'workspace' && (
        <div className="workspace-grid">
          <aside className="panel left-panel">
            <div className="panel-toolbar">
              <button onClick={addRootFolder}>+ Root Folder</button>
              <button onClick={() => addDocs(null)}>+ Doc</button>
              <button onClick={() => addScannedPdf(null)}>+ Scanned PDF (OCR)</button>
            </div>
            <div className="sort-row">
              <label>Sort by</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
                <option value="name">Name</option>
                <option value="date">Date added</option>
                <option value="size">Size</option>
                <option value="coded">Amount coded</option>
              </select>
            </div>
            <DocTree
              folders={project.folders}
              docs={project.docs}
              selectedDocId={selectedDocId}
              sortBy={sortBy}
              codedCount={codedCountForDoc}
              onSelectDoc={d => { setSelectedDocId(d.id); setPendingSelection(null); setEditingDocId(null); }}
              onAddRootFolder={addRootFolder}
              onAddSubfolder={addSubfolder}
              onAddDoc={addDocs}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              onRenameDoc={renameDoc}
              onDeleteDoc={deleteDoc}
              onMoveDoc={moveDoc}
            />
          </aside>

          <main className="panel center-panel" style={THEME_STYLES[readerTheme]}>
            {selectedDoc ? (
              <>
              {/* Reading Theme Switcher Buttons */}
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
    <span style={{ fontSize: '12px', opacity: 0.7 }}>Theme:</span>
    <button

            className="mini-btn"
      onClick={() => setReaderTheme('paperwhite')}
      style={{
        fontWeight: readerTheme === 'paperwhite' ? 'bold' : 'normal',
        border: readerTheme === 'paperwhite' ? '2px solid #3b82f6' : '1px solid #d6c7b2'
      }}
    >
      📜 Paperwhite
    </button>
    <button
      className="mini-btn"
      onClick={() => setReaderTheme('white')}
      style={{
        fontWeight: readerTheme === 'white' ? 'bold' : 'normal',
        border: readerTheme === 'white' ? '2px solid #3b82f6' : '1px solid #cbd5e1'
      }}
    >
      ☀️ White
    </button>
    <button
      className="mini-btn"
      onClick={() => setReaderTheme('dark')}
      style={{
        fontWeight: readerTheme === 'dark' ? 'bold' : 'normal',
        border: readerTheme === 'dark' ? '2px solid #3b82f6' : '1px solid #475569'
      }}
    >
      🌙 Dark
    </button>
  </div>
                <div className="doc-title-row">
                  <h3>{selectedDoc.name}</h3>
                  {showDocNotes && (
                  <div className="doc-notes-panel">
                    <label>Document memo — whole-case notes, interpretation, context</label>
                    <textarea
                      value={docNotesDraft}
                      onChange={e => setDocNotesDraft(e.target.value)}
                      onBlur={() => updateDocNotes(selectedDoc.id, docNotesDraft)}
                      placeholder="e.g. this interview took place after the flood; participant was guarded until minute 20…"
                    />
                  </div>
                )}
                  {editingDocId === selectedDoc.id ? (
                    <span className="doc-title-actions">
                      <button className="primary-btn" onClick={saveEditDoc}>💾 Save</button>
                      <button onClick={cancelEditDoc}>Cancel</button>
                    </span>
                  ) : (
                    <span className="doc-title-actions">
                      {pendingSelection && (
                        <span className="selection-hint">
                          Selected {pendingSelection.text.length} chars — click a code in the legend to apply it
                        </span>
                      )}
                      <button onClick={() => startEditDoc(selectedDoc)}>✏️ Edit text</button>
                      <button onClick={() => setShowDocNotes(v => !v)}>
                        📝 Notes{selectedDoc.notes ? ' ●' : ''}
                      </button>
                      <button onClick={() => handleExportDocDocx(selectedDoc)}>📤 Export as Word (.docx)</button>
                    </span>
                  )}
                </div>
                {editingDocId === selectedDoc.id ? (
                  <>
                    {docSegments.length > 0 && (
                      <div className="edit-warning">
                        This document has {docSegments.length} coded passage(s). Passages whose exact
                        text is preserved will stay coded; anything you change or delete will lose its code.
                      </div>
                    )}
                    <textarea
                      className="doc-edit-textarea"
                      style={THEME_STYLES[readerTheme]}
                      value={draftContent}
                      onChange={e => setDraftContent(e.target.value)}
                      spellCheck={false}
                    />
                  </>
                ) : (
                  <DocEditor
                    doc={selectedDoc}
                    segments={docSegments}
                    codesById={codesById}
                    onSelectionChange={setPendingSelection}
                    onClickSegment={(segs, x, y) => setSegmentPopup({ segments: segs, x, y })}
                  />
                )}
              </>
            ) : (
              <div className="empty-hint center">Select a document to start coding.</div>
            )}
          </main>

          <aside className="panel right-panel">
            <div className="panel-toolbar">
              <button onClick={addRootCode}>+ Root Code</button>
            </div>
            <CodeSearch
              codes={project.codes}
              query={workspaceCodeSearch}
              onQueryChange={setWorkspaceCodeSearch}
              onSelectCode={handleWorkspaceCodeClick}
              applyHint={!!pendingSelection}
              placeholder={pendingSelection ? 'Search codes to apply…' : 'Search codes…'}
            />
            {!workspaceCodeSearch.trim() && (
              <CodeTree
                codes={project.codes}
                selectedCodeId={null}
                onSelectCode={handleWorkspaceCodeClick}
                onAddSubcode={addSubcode}
                onDeleteCode={deleteCode}
                onMoveCode={moveCode}
                applyHint={!!pendingSelection}
              />
            )}
          </aside>

          {segmentPopup && (
            <div className="segment-popup" style={{ left: segmentPopup.x, top: segmentPopup.y }}>
              <div className="segment-popup-title">Codes applied here</div>
              {segmentPopup.segments.map(s => (
                <div key={s.id} className="segment-popup-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="code-swatch" style={{ background: codesById.get(s.codeId)?.color }} />
                    <span style={{ flex: 1 }}>{codesById.get(s.codeId)?.name || 'Unknown code'}</span>
                    <button className="mini-btn" onClick={() => removeCodedSegment(s.id)}>Remove</button>
                  </div>

                  {editingNoteFor === s.id ? (
                    <>
                      <textarea
                        className="modal-input"
                        style={{ minHeight: 60, marginTop: 4 }}
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="mini-btn" onClick={() => { updateSegmentNote(s.id, noteDraft); setEditingNoteFor(null); }}>Save</button>
                        <button className="mini-btn" onClick={() => setEditingNoteFor(null)}>Cancel</button>
                      </div>
                    </>
                  ) : s.note ? (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 2, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span>📝 {s.note}</span>
                      <button className="mini-btn" onClick={() => { setEditingNoteFor(s.id); setNoteDraft(s.note || ''); }}>Edit</button>
                    </div>
                  ) : (
                    <button
                      className="mini-btn"
                      style={{ alignSelf: 'flex-start', marginTop: 2 }}
                      onClick={() => { setEditingNoteFor(s.id); setNoteDraft(''); }}
                    >
                      + Add note
                    </button>
                  )}
                </div>
              ))}
              <button className="close-popup" onClick={() => setSegmentPopup(null)}>Close</button>
            </div>
          )}
        </div>
      )}

      {tab === 'codebook' && (
        <div className="codebook-grid">
          <aside className="panel left-panel">
            <div className="panel-toolbar">
              <button onClick={addRootCode}>+ Root Code</button>
              <button onClick={handleCsvImport}>➕ Import Dataset (CSV)</button>
              <button onClick={handleQdpxImport}>➕ Import REFI-QDA (.qdpx)</button>
              <div className="panel-toolbar">
  <select value={exportScope} onChange={e => setExportScope(e.target.value as ExportScope)}>
    {Object.entries(SCOPE_LABELS).map(([key, label]) => (
      <option key={key} value={key}>{label}</option>
    ))}
  </select>
  <button onClick={handleExportCsv}>⬇️ CSV</button>
  <button onClick={handleExportDocx}>⬇️ DOCX</button>
</div>
            </div>
            <CodeSearch
              codes={project.codes}
              query={codebookCodeSearch}
              onQueryChange={setCodebookCodeSearch}
              onSelectCode={code => setCodebookSelectedCodeId(code.id)}
              placeholder="Search codes…"
            />
            {!codebookCodeSearch.trim() && (
              <CodeTree
                codes={project.codes}
                selectedCodeId={codebookSelectedCodeId}
                onSelectCode={code => setCodebookSelectedCodeId(code.id)}
                onAddSubcode={addSubcode}
                onDeleteCode={deleteCode}
                onMoveCode={moveCode}
              />
            )}
          </aside>

          <main className="panel center-panel" style={THEME_STYLES[readerTheme]}>
  <h3>Excerpts</h3>
  {codebookCode ? (
    codebookExcerpts.length > 0 ? (
      <div className="excerpt-list">
        {codebookExcerpts.map(seg => {
          const doc = project.docs.find(d => d.id === seg.docId);
          return (
            <div 
              key={seg.id} 
              className="excerpt-card"
              style={{
                // 'dark' gets slate, 'white' gets pure white, 'paperwhite' gets warm yellow
                backgroundColor: readerTheme === 'dark' ? '#1e293b' : (readerTheme === 'white' ? '#ffffff' : '#fef3c7'),
                color: readerTheme === 'dark' ? '#f8fafc' : '#0f172a',
                border: readerTheme === 'dark' ? '1px solid #334155' : (readerTheme === 'white' ? '1px solid #e2e8f0' : '1px solid #fde68a')
              }}
            >
              <div className="excerpt-doc">{doc?.name || 'Unknown source'}</div>
              <div className="excerpt-text">“{seg.text}”</div>
              <button className="mini-btn" onClick={() => removeCodedSegment(seg.id)}>Remove</button>
            </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-hint">No excerpts coded to this code yet.</div>
              )
            ) : (
              <div className="empty-hint">Select a code on the left to review its excerpts.</div>
            )}
          </main>

          <aside className="panel right-panel">
            <h3>Code details</h3>
            {codebookCode ? (
              <div className="code-detail">
                <label>Name</label>
                <input
                  value={codebookCode.name}
                  onChange={e => updateCode(codebookCode.id, { name: e.target.value })}
                />
                <label>Color</label>
                <div className="color-picker">
                  {['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6'].map(c => (
                    <button
                      key={c}
                      className={`swatch-btn ${codebookCode.color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateCode(codebookCode.id, { color: c })}
                    />
                  ))}
                </div>
                <label>Summary / memo</label>
                <textarea
                  value={codebookCode.summary}
                  rows={10}
                  onChange={e => updateCode(codebookCode.id, { summary: e.target.value })}
                />
                <button onClick={() => pullChildSummaries(codebookCode.id)}>⚡ Pull Child Summaries</button>
              </div>
            ) : (
              <div className="empty-hint">Select a code to edit its details.</div>
            )}
          </aside>
        </div>
      )}

{tab === 'about' && (
  <main 
    className="panel about-panel" 
    style={{ 
      padding: '40px', 
      maxWidth: '600px', 
      margin: '40px auto', 
      textAlign: 'center', 
      backgroundColor: 'var(--panel)', 
      color: 'var(--text)', 
      borderRadius: '8px', 
      border: '1px solid var(--border)',
      boxShadow: '0 4px 12px var(--shadow)',
      overflowX: 'hidden'
    }}
  >
    <img 
      src="./eqc-logo.png" 
      alt="EQC Logo" 
      style={{ width: '120px', height: '120px', marginBottom: '20px' }} 
    />
    <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: 'var(--text)' }}>EQC - Easy Qual Coding</h2>
    <p style={{ fontWeight: 'bold', color: '#fb923c', marginBottom: '20px' }}>Version {pkg.version}</p>
    
    <p style={{ lineHeight: '1.6', marginBottom: '30px', fontSize: '16px', color: 'var(--text)' }}>
      Designed to strip away the complexity of traditional QDA software. 
      EQC offers a lightweight, intuitive environment for researchers to seamlessly weave text into meaningful insights.
    </p>

    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', fontSize: '14px', lineHeight: '1.8', color: 'var(--text-dim)' }}>
      <p><strong style={{ color: 'var(--text)' }}>Made by:</strong> Anisur Rahman Bayazid <em>(with help from borrowed intellect)</em></p>
      <p><strong style={{ color: 'var(--text)' }}>Contact:</strong> <a href="mailto:anisur.rahman.bayazid@gmail.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>anisur.rahman.bayazid@gmail.com</a></p>
      <p><strong style={{ color: 'var(--text)' }}>License:</strong> MIT License - Open and free for commercial and non-commercial use.</p>
      <p><strong style={{ color: 'var(--text)' }}>Year:</strong> 2026</p>
    </div>
  </main>
)}

      {tab === 'autocode' && (
        <div className="autocode-panel panel">
          <h3>Auto-Coder</h3>
          <p className="section-hint">Apply a code to every occurrence of a keyword or phrase across the whole project.</p>
          <div className="form-grid">
            <label>Search keyword / phrase</label>
            <input value={acKeyword} onChange={e => setAcKeyword(e.target.value)} placeholder="e.g. flood, sandbags" />

            <label>Capture boundary</label>
            <div className="radio-row">
              <label><input type="radio" checked={acBoundary === 'exact'} onChange={() => setAcBoundary('exact')} /> Exact Match Only</label>
              <label><input type="radio" checked={acBoundary === 'sentence'} onChange={() => setAcBoundary('sentence')} /> Enclosing Sentence</label>
            </div>

            {acBoundary === 'sentence' && (
              <>
                <label>Language</label>
                <select value={acLanguage} onChange={e => setAcLanguage(e.target.value)}>
                  {AUTO_CODE_LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </>
            )}

            <label>Target code</label>
            <select value={acTargetCodeId} onChange={e => setAcTargetCodeId(e.target.value)}>
              <option value="">Select a code…</option>
              {flatCodes.map(({ code, depth }) => (
                <option key={code.id} value={code.id}>{'—'.repeat(depth)} {code.name}</option>
              ))}
            </select>

            <div />
            <button className="primary-btn" onClick={runAutoCodeJob}>Execute Auto-Code Job</button>
          </div>
          {acResult && <div className="autocode-result">{acResult}</div>}
        </div>
      )}

      {tab === 'analysis' && (
        <AnalysisTab project={project} onExportReport={handleExportReport} onSaveCell={updateFrameworkCell} showToast={showToast} />
      )}

      {toast && <div className="toast">{toast}</div>}
      {promptModal}
    </div>
  );
}

function FrameworkCellInput({ initialValue, onSave }: { initialValue: string; onSave: (text: string) => void }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue]);
  return (
    <textarea
      className="framework-cell-input"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value !== initialValue) onSave(value); }}
      placeholder="—"
    />
  );
}

function AnalysisExportButtons({
  title, filenameBase, headers, rows, showToast
}: {
  title: string;
  filenameBase: string;
  headers: string[];
  rows: (string | number)[][];
  showToast: (msg: string) => void;
}) {
  async function doExport(kind: 'csv' | 'docx') {
    const csvRows = rows.map((row) => row.map((value) => String(value)));
    const path = kind === 'csv'
      ? await window.qv.exportText({
          title: `Export ${title} (CSV)`,
          defaultName: `${filenameBase}.csv`,
          content: toCsv(headers, csvRows),
          extension: 'csv',
          filterName: 'CSV file'
        })
      : await window.qv.exportDocxTable({
          kind: 'table',
          title,
          headers,
          rows: csvRows,
          filenameBase
        });
    if (path) showToast(`Exported ${title} to ${path}`);
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={() => doExport('csv')}>⬇️ CSV</button>
      <button onClick={() => doExport('docx')}>⬇️ DOCX</button>
    </div>
  );
}

function AnalysisTab({ project, onExportReport, onSaveCell, showToast }: { project: Project; onExportReport: () => void; onSaveCell: (docId: ID, codeId: ID, text: string) => void; showToast: (msg: string) => void }) {
  const [subTab, setSubTab] = useState<'frequency' | 'docMatrix' | 'coMatrix' | 'framework'>('frequency');
  const [freqSort, setFreqSort] = useState<FreqSortKey>('groupedNameAsc');
  const freqTree = useMemo(() => sortFrequencyTree(project, freqSort), [project, freqSort]);
  const docMatrix = useMemo(() => codeDocumentMatrix(project), [project]);
  const coMatrix = useMemo(() => codeCooccurrenceMatrix(project), [project]);
  const maxRolledUp = Math.max(1, ...freqTree.map(f => f.rolledUpCount));
  const frameworkRows = useMemo(() => childCodes(project.codes, null), [project.codes]);
  const frameworkCellMap = useMemo(() => {
    const m = new Map<string, FrameworkCell>();
    (project.frameworkCells || []).forEach(c => m.set(`${c.docId}::${c.codeId}`, c));
    return m;
  }, [project.frameworkCells]);


  return (
    <div className="analysis-panel panel">
      <div className="analysis-header">
        <h3>Analysis Dashboard</h3>
        <button onClick={onExportReport}>📄 Export HTML Report</button>
      </div>

      <nav className="subtabs">
        <button className={`subtab-btn ${subTab === 'frequency' ? 'active' : ''}`} onClick={() => setSubTab('frequency')}>
          Coding Frequency
        </button>
        <button className={`subtab-btn ${subTab === 'docMatrix' ? 'active' : ''}`} onClick={() => setSubTab('docMatrix')}>
          Code × Document Matrix
        </button>
        <button className={`subtab-btn ${subTab === 'coMatrix' ? 'active' : ''}`} onClick={() => setSubTab('coMatrix')}>
          Code Co-occurrence Matrix
        </button>
        <button className={`subtab-btn ${subTab === 'framework' ? 'active' : ''}`} onClick={() => setSubTab('framework')}>
          Framework Matrix
        </button>
      </nav>

      {subTab === 'frequency' && (
        <section>
          <div className="sort-row">
            <label>Sort</label>
            <select value={freqSort} onChange={e => setFreqSort(e.target.value as FreqSortKey)}>
              <option value="groupedNameAsc">Grouped, A → Z</option>
              <option value="groupedNameDesc">Grouped, Z → A</option>
              <option value="groupedCountDesc">Grouped, highest → lowest</option>
              <option value="groupedCountAsc">Grouped, lowest → highest</option>
              <option value="countDesc">Highest → lowest</option>
              <option value="countAsc">Lowest → highest</option>
              <option value="nameAsc">A → Z</option>
              <option value="nameDesc">Z → A</option>
            </select>
            <AnalysisExportButtons
              title={`${project.name} — Coding Frequency`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_coding_frequency`}
              headers={['Theme / Code', 'Depth', 'Direct Count', 'Total (incl. nested)']}
              rows={freqTree.map(f => [f.code.name, f.depth, f.ownCount, f.rolledUpCount])}
              showToast={showToast}
            />
          </div>
          <div className="freq-chart">
            {freqTree.map(f => (
              <div key={f.code.id} className="freq-row" style={{ paddingLeft: f.depth * 16 }}>
                <span className="freq-label" title={f.code.name}>
                  {f.code.name}
                  {f.hasChildren && (
                    <span className="section-hint" style={{ marginLeft: 6 }}>
                      ({f.ownCount} direct + {f.rolledUpCount - f.ownCount} nested)
                    </span>
                  )}
                </span>
                <div className="freq-bar-track">
                  <div
                    className="freq-bar"
                    style={{ width: `${(f.rolledUpCount / maxRolledUp) * 100}%`, background: f.code.color }}
                  />
                </div>
                <span className="freq-count">{f.rolledUpCount}</span>
              </div>
            ))}
            {freqTree.length === 0 && <div className="empty-hint">No codes yet.</div>}
          </div>
        </section>
      )}

      {subTab === 'docMatrix' && (
        <section>
          <div className="sort-row">
            <span className="section-hint">Code × Document coding counts</span>
            <AnalysisExportButtons
              title={`${project.name} — Code × Document Matrix`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_code_document_matrix`}
              headers={['Code', ...project.docs.map(d => d.name)]}
              rows={project.codes.map(code => [code.name, ...project.docs.map(d => docMatrix.get(code.id)?.get(d.id) || 0)])}
              showToast={showToast}
            />
          </div>
          <div className="matrix-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Code</th>
                  {project.docs.map(d => <th key={d.id}>{d.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {project.codes.map(code => (
                  <tr key={code.id}>
                    <td className="matrix-code-cell"><span className="code-swatch" style={{ background: code.color }} />{code.name}</td>
                    {project.docs.map(d => (
                      <td key={d.id}>{docMatrix.get(code.id)?.get(d.id) || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {project.codes.length === 0 && <div className="empty-hint">No codes yet.</div>}
          </div>
        </section>
      )}

      {subTab === 'coMatrix' && (
        <section>
          <div className="sort-row">
            <span className="section-hint">How often codes co-occur on the same passage</span>
            <AnalysisExportButtons
              title={`${project.name} — Code Co-occurrence Matrix`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_code_cooccurrence_matrix`}
              headers={['', ...project.codes.map(c => c.name)]}
              rows={project.codes.map(rowCode => [
                rowCode.name,
                ...project.codes.map(colCode => (rowCode.id === colCode.id ? '' : coMatrix.get(rowCode.id)?.get(colCode.id) || 0))
              ])}
              showToast={showToast}
            />
          </div>
          <div className="matrix-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th />
                  {project.codes.map(c => <th key={c.id}>{c.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {project.codes.map(rowCode => (
                  <tr key={rowCode.id}>
                    <td className="matrix-code-cell"><span className="code-swatch" style={{ background: rowCode.color }} />{rowCode.name}</td>
                    {project.codes.map(colCode => (
                      <td key={colCode.id} className={rowCode.id === colCode.id ? 'diag-cell' : ''}>
                        {rowCode.id === colCode.id ? '\u2014' : coMatrix.get(rowCode.id)?.get(colCode.id) || 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {project.codes.length === 0 && <div className="empty-hint">No codes yet.</div>}
          </div>
        </section>
      )}

      {subTab === 'framework' && (
        <section>
          <div className="sort-row">
            <span className="section-hint">One short summary per theme, per case. Click a cell to write or edit — saves when you click away.</span>
            <AnalysisExportButtons
              title={`${project.name} — Framework Matrix`}
              filenameBase={`${project.name.replace(/[^\w\- ]/g, '_')}_framework_matrix`}
              headers={['Theme', ...project.docs.map(d => d.name)]}
              rows={frameworkRows.map(code => [
                code.name,
                ...project.docs.map(d => frameworkCellMap.get(`${d.id}::${code.id}`)?.text || '')
              ])}
              showToast={showToast}
            />
          </div>
          <div className="matrix-wrap">
            <table className="matrix-table framework-matrix-table">
              <thead>
                <tr>
                  <th>Theme</th>
                  {project.docs.map(d => <th key={d.id}>{d.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {frameworkRows.map(code => (
                  <tr key={code.id}>
                    <td className="matrix-code-cell"><span className="code-swatch" style={{ background: code.color }} />{code.name}</td>
                    {project.docs.map(d => {
                      const existing = frameworkCellMap.get(`${d.id}::${code.id}`);
                      return (
                        <td key={d.id} className="framework-cell">
                          <FrameworkCellInput
                            initialValue={existing?.text || ''}
                            onSave={text => onSaveCell(d.id, code.id, text)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {frameworkRows.length === 0 && <div className="empty-hint">No top-level (theme) codes yet — add a root code to use the framework matrix.</div>}
            {project.docs.length === 0 && <div className="empty-hint">No documents yet.</div>}
          </div>
        </section>
      )}
    </div>
  );
}