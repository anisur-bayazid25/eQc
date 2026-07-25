const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const mammoth = require('mammoth');
const Papa = require('papaparse');

const isDev = process.env.NODE_ENV === 'development';

const JSZip = require('jszip');

// ---------------------------------------------------------------------
// SQLite setup — one row per project, whole project stored as JSON.
// This mirrors the JSON-store-to-SQLite migration already used by the
// app: it keeps persistence simple and robust while still being local,
// file-backed, and queryable if the schema needs to be normalized later.
// ---------------------------------------------------------------------
let db;
function initDb() {
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'eqc.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Defensive migration: if a `projects` table already existed from an
  // older/partial run (e.g. created before `updated_at` was added),
  // `CREATE TABLE IF NOT EXISTS` above is a no-op and leaves the old
  // schema in place. Detect and patch that here instead of crashing on
  // the first query that references the missing column.
  const existingColumns = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
  if (!existingColumns.includes('updated_at')) {
    db.exec('ALTER TABLE projects ADD COLUMN updated_at INTEGER');
    db.exec('UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL');
  }
  if (!existingColumns.includes('created_at')) {
    db.exec('ALTER TABLE projects ADD COLUMN created_at INTEGER');
    db.exec(`UPDATE projects SET created_at = ${Date.now()} WHERE created_at IS NULL`);
  }

  // One-time migration from a legacy JSON store, if present.
  const legacyPath = path.join(dir, 'eqc-projects.json');
  if (fs.existsSync(legacyPath)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
      const projects = Array.isArray(legacy) ? legacy : Object.values(legacy || {});
      const insert = db.prepare(
        'INSERT OR IGNORE INTO projects (id, name, created_at, data, updated_at) VALUES (?,?,?,?,?)'
      );
      const tx = db.transaction(rows => {
        for (const p of rows) {
          if (p && p.id) {
            insert.run(p.id, p.name || 'Untitled', p.createdAt || Date.now(), JSON.stringify(p), Date.now());
          }
        }
      });
      tx(projects);
      fs.renameSync(legacyPath, legacyPath + '.migrated');
    } catch (e) {
      console.error('Legacy JSON migration failed:', e);
    }
  }
}

function listProjects() {
  return db.prepare('SELECT id, name, created_at as createdAt FROM projects ORDER BY updated_at DESC').all();
}

function loadProject(id) {
  const row = db.prepare('SELECT data FROM projects WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : null;
}

function saveProject(project) {
  const now = Date.now();
  db.prepare(`
    INSERT INTO projects (id, name, created_at, data, updated_at)
    VALUES (@id, @name, @createdAt, @data, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      data = excluded.data,
      updated_at = excluded.updated_at
  `).run({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt || now,
    data: JSON.stringify(project),
    updatedAt: now
  });
  return project;
}

function deleteProjectRow(id) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// ---------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------
let mainWindow;

function createWindow() {
  // Add this single line right here to hide the menu:
  Menu.setApplicationMenu(null);

 mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'eQc - Easy Qual Coding',
    icon: path.join(__dirname, 'assets', 'eqc_icon.ico'), // Keep your new icon!
    webPreferences: {
      // Restore the preload script (adjust the filename if yours was named differently, like preload.js)
      preload: path.join(__dirname, 'preload.cjs'), 
      contextIsolation: true, 
      nodeIntegration: false
    }
  });
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  initDb();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------
// Helpers: document text extraction
// ---------------------------------------------------------------------
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  if (ext === '.docx') {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (ext === '.pdf') {
    // Lazy-require: pdf-parse touches the filesystem for its own test
    // assets on import in some versions, so only load it when needed.
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (ext === '.csv') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

// ---------------------------------------------------------------------
// IPC: projects
// ---------------------------------------------------------------------
ipcMain.handle('projects:list', () => listProjects());
ipcMain.handle('projects:load', (_e, id) => loadProject(id));
ipcMain.handle('projects:save', (_e, project) => saveProject(project));
ipcMain.handle('projects:delete', (_e, id) => {
  deleteProjectRow(id);
  return true;
});

// ---------------------------------------------------------------------
// IPC: document import (.txt, .md, .docx, .pdf)
// ---------------------------------------------------------------------
ipcMain.handle('docs:pickAndExtract', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Add documents',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Supported documents', extensions: ['txt', 'md', 'docx', 'pdf'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  if (canceled) return [];

// Splits on blank-line gaps into paragraphs, and single newlines within a
// paragraph into soft line breaks, so exported layout roughly matches what
// you see in the editor.

  const out = [];
  for (const fp of filePaths) {
    try {
      const text = await extractText(fp);
      const stat = fs.statSync(fp);
      out.push({
        name: path.basename(fp),
        content: text,
        sizeBytes: stat.size,
        ok: true
      });
    } catch (e) {
      out.push({ name: path.basename(fp), content: '', sizeBytes: 0, ok: false, error: String(e.message || e) });
    }
  }
  return out;
});

// ---------------------------------------------------------------------
// IPC: REFI-QDA (.qdpx) import
// .qdpx is a zip archive containing project.qde (XML, REFI-QDA-2 schema)
// plus a Sources/ folder of referenced source files. We unzip and hand
// back raw text here; the renderer (qdpxImport.ts) parses the XML and
// merges it into the in-memory Project, same division of labor as CSV
// import.
// ---------------------------------------------------------------------
ipcMain.handle('qdpx:pickAndParse', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import REFI-QDA project (.qdpx)',
    properties: ['openFile'],
    filters: [{ name: 'REFI-QDA project', extensions: ['qdpx'] }]
  });
  if (canceled || filePaths.length === 0) return null;

  const buffer = fs.readFileSync(filePaths[0]);
  const zip = await JSZip.loadAsync(buffer);

  // project.qde is usually at the archive root, but be tolerant of it
  // being nested (some tools wrap it in a subfolder).
  const qdeEntry = Object.values(zip.files).find(
    f => !f.dir && f.name.toLowerCase().endsWith('.qde')
  );
  if (!qdeEntry) {
    throw new Error('No project.qde file found inside this .qdpx archive.');
  }
  const qdeXml = await qdeEntry.async('string');

  // Pull every file under Sources/ as text. Binary source types (audio,
  // video, images, PDFs) are intentionally skipped for now — MVP only
  // imports TextSource content, which covers the common case of
  // transcripts/interviews/documents coded as plain text.
  const sourceFiles = {};
  const sourceEntries = Object.values(zip.files).filter(
    f => !f.dir && /(^|\/)sources\//i.test(f.name)
  );
  for (const entry of sourceEntries) {
    try {
      sourceFiles[entry.name] = await entry.async('string');
    } catch {
      // Binary file (e.g. embedded audio/PDF) — skip, not text-decodable.
    }
  }

  return {
    fileName: path.basename(filePaths[0]),
    qdeXml,
    sourceFiles
  };
});

// ---------------------------------------------------------------------
// IPC: export a document as a .docx file
// ---------------------------------------------------------------------

const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = require('docx');

function contentToParagraphs(content) {
  const blocks = content.split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split(/\n/);
    const children = [];
    lines.forEach((line, i) => {
      if (i > 0) children.push(new TextRun({ break: 1 }));
      children.push(new TextRun(line));
    });
    return new Paragraph({ children });
  });
}

ipcMain.handle('docs:exportDocx', async (_e, { name, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export document as Word file',
    defaultPath: `${name.replace(/\.[^/.]+$/, '').replace(/[^\w\- ]/g, '_')}.docx`,
    filters: [{ name: 'Word document', extensions: ['docx'] }]
  });
  if (canceled || !filePath) return null;

  const doc = new Document({ sections: [{ children: contentToParagraphs(content) }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return filePath;
});

// ---------------------------------------------------------------------
// IPC: generic plain-text file export (CSV, etc.)
// ---------------------------------------------------------------------
ipcMain.handle('export:saveText', async (_e, { title, defaultName, content, extension, filterName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: title || 'Export',
    defaultPath: defaultName,
    filters: [{ name: filterName || 'File', extensions: [extension || 'txt'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
});

// ---------------------------------------------------------------------
// IPC: generic .docx export — either a flat table or a codebook outline
// ---------------------------------------------------------------------
function buildTableDocx(title, headers, rows) {
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })]
    }))
  });
  const dataRows = rows.map(r => new TableRow({
    children: r.map(cell => new TableCell({ children: [new Paragraph(String(cell ?? ''))] }))
  }));
  const table = new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
  return new Document({
    sections: [{ children: [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }), table] }]
  });
}

function buildOutlineDocx(title, nodes) {
  const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
  const children = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  for (const node of nodes) {
    children.push(new Paragraph({ text: node.name, heading: levels[Math.min(node.depth, levels.length - 1)] }));
    if (node.summary) {
      children.push(new Paragraph({ text: node.summary, indent: { left: 360 * (node.depth + 1) } }));
    }
    if (Array.isArray(node.quotes)) {
      for (const q of node.quotes) {
        children.push(new Paragraph({
          children: [new TextRun({ text: q, italics: true })],
          indent: { left: 360 * (node.depth + 1) + 180 },
          spacing: { after: 80 }
        }));
      }
    }
  }
  return new Document({ sections: [{ children }] });
}

ipcMain.handle('export:docx', async (_e, payload) => {
  console.log('export:docx payload received:', JSON.stringify(payload).slice(0, 2000));
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as Word file',
    defaultPath: `${payload.filenameBase.replace(/[^\w\- ]/g, '_')}.docx`,
    filters: [{ name: 'Word document', extensions: ['docx'] }]
  });
  if (canceled || !filePath) return null;

  const doc = payload.kind === 'outline'
    ? buildOutlineDocx(payload.title, payload.outline)
    : buildTableDocx(payload.title, payload.headers, payload.rows);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return filePath;
});

// ---------------------------------------------------------------------
// IPC: CSV codebook/dataset import
// Parses a CSV using the flexible header-matching scheme from the
// eQc user guide (Participant/Document/Source, Quote/Excerpt/Text,
// Parent Node/Parent, Child Node 1/Child 1, Child Node 2/Child 2, and
// Summary of ... columns). Returns raw parsed rows + detected column
// roles; the renderer builds the code tree / docs / codedSegments so it
// can merge with in-memory project state and undo cleanly.
// ---------------------------------------------------------------------
function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

const HEADER_MAP = {
  source: ['participant', 'document', 'source'],
  quote: ['quote', 'quotes', 'excerpt', 'text'],
  parent: ['parent node', 'parent'],
  child1: ['child node 1', 'child 1'],
  child2: ['child node 2', 'child 2']
};

const iconv = require('iconv-lite');

// Excel's plain "CSV" export (as opposed to "CSV UTF-8") writes
// Windows-1252, not UTF-8 — smart quotes/apostrophes are the most common
// casualty, decoding as U+FFFD when forced through a UTF-8 decoder. Detect
// that and fall back to Windows-1252 decoding of the same bytes.
function readCsvSmart(filePath) {
  const buffer = fs.readFileSync(filePath);
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const utf8Text = hasBom ? buffer.slice(3).toString('utf-8') : buffer.toString('utf-8');
  if (!hasBom && utf8Text.includes('\uFFFD')) {
    return iconv.decode(buffer, 'win1252');
  }
  return utf8Text;
}

ipcMain.handle('csv:pickAndParse', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Dataset (CSV)',
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (canceled || filePaths.length === 0) return null;

  const raw = readCsvSmart(filePaths[0]);
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
  const fields = (parsed.meta.fields || []).map(f => ({ raw: f, norm: normalizeHeader(f) }));

  const findField = keys => {
    const hit = fields.find(f => keys.includes(f.norm));
    return hit ? hit.raw : null;
  };

  const columns = {
    source: findField(HEADER_MAP.source),
    quote: findField(HEADER_MAP.quote),
    parent: findField(HEADER_MAP.parent),
    child1: findField(HEADER_MAP.child1),
    child2: findField(HEADER_MAP.child2)
  };

  // Summary columns: anything starting with "summary of" or ending "summary"
  const summaryFields = fields.filter(
    f => f.norm.startsWith('summary of') || f.norm.endsWith('summary')
  );

  return {
    fileName: path.basename(filePaths[0]),
    columns,
    summaryFields: summaryFields.map(f => f.raw),
    rows: parsed.data,
    errors: parsed.errors
  };
});

// ---------------------------------------------------------------------
// IPC: JSON backup export / import / merge
// ---------------------------------------------------------------------
ipcMain.handle('backup:export', async (_e, project) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export project backup',
    defaultPath: `${project.name.replace(/[^\w\- ]/g, '_')}.json`,
    filters: [{ name: 'eQc backup', extensions: ['json'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
  return filePath;
});

ipcMain.handle('backup:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import project backup',
    properties: ['openFile'],
    filters: [{ name: 'eQc backup', extensions: ['json'] }]
  });
  if (canceled || filePaths.length === 0) return null;
  const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
  return data;
});

ipcMain.handle('backup:pickMultipleForMerge', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Merge project(s) into current project',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'eQc backup', extensions: ['json'] }]
  });
  if (canceled || filePaths.length === 0) return [];
  return filePaths.map(fp => JSON.parse(fs.readFileSync(fp, 'utf-8')));
});

// ---------------------------------------------------------------------
// IPC: HTML analysis report export
// ---------------------------------------------------------------------
ipcMain.handle('report:export', async (_e, { project, html }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export analysis report',
    defaultPath: `${project.name.replace(/[^\w\- ]/g, '_')}_report.html`,
    filters: [{ name: 'HTML report', extensions: ['html'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
});
