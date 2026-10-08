const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const mammoth = require('mammoth');
const Papa = require('papaparse');

const isDev = process.env.NODE_ENV === 'development';

const JSZip = require('jszip');

// Hoisted to module scope (not lazily inside the builders below): the
// release test suite extracts buildTableDocx/buildOutlineDocx/
// buildImageGalleryDocx by source slice and evaluates them in a vm context
// that provides the docx exports as bare globals but has no `require`.
// An in-function require('docx') breaks that contract (and CI).
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun } = require('docx');

const { autoUpdater } = require('electron-updater');
const https = require('https');
const setupLan = require('./lan.cjs');
const { buildCodeReportDocx, safeFilename } = require('./codeReport.cjs');
const { captureOriginalSource, decodeOriginalSource } = require('./sourceOriginal.cjs');
const projectHistory = require('./projectHistory.cjs');
const { createProfileTimeStore } = require('./profileTimeStore.cjs');
let profileTime;

// Prevents a second checkForUpdates() call (e.g. the "Check for Updates"
// button on the About tab) from starting a duplicate download while one
// is already in progress.
let updateDownloadInFlight = false;

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
  profileTime=createProfileTimeStore(db);
  projectHistory.installHistory(db);
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

function saveProject(project, metadata) {
  const now = Date.now();
  db.transaction(() => {
  const before = loadProject(project.id);
  projectHistory.recordSave(db, before, project, metadata, now);
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
  })();
  return project;
}

function deleteProjectRow(id) {
  db.transaction(() => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    db.prepare('DELETE FROM project_activity WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM project_snapshots WHERE project_id = ?').run(id);
  })();
}

// ---------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------
let mainWindow;
let profileCloseAllowed=false,profileClosePending=false,profileCloseTimer;
async function finishProfileClose(result){
  if(!profileClosePending)return;
  clearTimeout(profileCloseTimer);profileClosePending=false;
  if(!result.ok){const answer=await dialog.showMessageBox(mainWindow,{type:'warning',title:'Time records could not be saved',message:'eQc could not confirm that the latest profile/time records were saved.',detail:result.message||'The app did not respond to the save request.',buttons:['Close anyway','Keep open'],defaultId:1,cancelId:1});if(answer.response!==0)return;}
  profileCloseAllowed=true;mainWindow.close();
}

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
  profileCloseAllowed=false;
  mainWindow.on?.('close',event=>{
    if(profileCloseAllowed)return;
    event.preventDefault();if(profileClosePending)return;
    profileClosePending=true;
    mainWindow.webContents.send('profiles:prepareClose');
    profileCloseTimer=setTimeout(()=>{void finishProfileClose({ok:false});},3000);
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
  setupLan(ipcMain, { getWindow: () => mainWindow, saveProject });

  // 🟢 Trigger the silent update check 3 seconds after initial launch
  setTimeout(() => checkForUpdates(true), 3000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Profile histories are separate from project data and LAN sharing.
ipcMain.handle('profiles:open',(_e,legacy)=>{
  if(legacy && profileTime.needsMigration()){
    const backup=path.join(app.getPath('userData'),'profile-time-before-sqlite.json');
    if(!fs.existsSync(backup))fs.writeFileSync(backup,JSON.stringify(legacy),'utf8');
  }
  return profileTime.open(legacy);
});
for(const method of ['write','select','create','delete','backup','validate','import'])ipcMain.handle(`profiles:${method}`,(_e,payload)=>profileTime[method](payload));
ipcMain.on('profiles:flush',(_e,payload)=>{try{profileTime.write(payload);}catch(error){console.error('Profile time could not be saved during close:',error);}});
ipcMain.on('profiles:closeReady',(event,result)=>{if(event.sender===mainWindow?.webContents)void finishProfileClose(result||{ok:false});});

function isNewerVersion(latest, current) {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

function fetchLatestGithubRelease() {
  return new Promise(resolve => {
    https.get(
      'https://api.github.com/repos/anisur-bayazid25/eQc/releases/latest',
      { headers: { 'User-Agent': 'eQc-desktop' } },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve({ latestVersion: (json.tag_name || '').replace(/^v/, ''), url: json.html_url });
          } catch {
            resolve(null);
          }
        });
      }
    ).on('error', () => resolve(null));
  });
}

async function checkForUpdates(silent) {
  if (process.platform === 'win32') {
    autoUpdater.autoDownload = false;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result?.updateInfo && isNewerVersion(result.updateInfo.version, app.getVersion())) {
        mainWindow.webContents.send('update:available', { version: result.updateInfo.version, platform: 'win32' });
        // Auto-start the download in the background — no click required.
        // Installing still waits for an explicit "Restart & Install" click.
        if (!updateDownloadInFlight) {
          updateDownloadInFlight = true;
          autoUpdater.autoDownload = true;
          autoUpdater.downloadUpdate().catch(err => {
            updateDownloadInFlight = false;
            mainWindow.webContents.send('update:error', String(err));
          });
        }
      } else if (!silent) {
        mainWindow.webContents.send('update:none');
      }
    } catch (err) {
      if (!silent) mainWindow.webContents.send('update:error', String(err));
    }
    return;
  }

  // macOS: unsigned build — Squirrel.Mac's silent apply step requires a
  // valid code signature to verify the downloaded update, which this
  // build doesn't have. Check GitHub directly instead and point the user
  // to a manual download rather than attempting (and failing) a silent
  // install.
  const info = await fetchLatestGithubRelease();
  if (info && isNewerVersion(info.latestVersion, app.getVersion())) {
    mainWindow.webContents.send('update:available', { version: info.latestVersion, url: info.url, platform: 'darwin' });
  } else if (!silent) {
    mainWindow.webContents.send('update:none');
  }
}

autoUpdater.on('update-downloaded', () => {
  updateDownloadInFlight = false;
  mainWindow.webContents.send('update:ready');
});

autoUpdater.on('download-progress', progress => {
  mainWindow.webContents.send('update:progress', Math.round(progress.percent));
});


// ---------------------------------------------------------------------
// Helpers: document text extraction
// ---------------------------------------------------------------------
const { convert: htmlToText } = require('html-to-text');

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  if (ext === '.docx') {
    const buffer = fs.readFileSync(filePath);
    // convertToHtml (not extractRawText) preserves tables/headings/lists
    // as real structure; html-to-text then renders that back down to
    // readable plain text, with tables specifically laid out as aligned
    // columns instead of every cell's text getting jammed together.
    const { value: html } = await mammoth.convertToHtml({ buffer });
    return htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: 'table', format: 'dataTable' },
        { selector: 'img', format: 'skip' }
      ]
    });
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
ipcMain.handle('projects:save', (_e, project, metadata) => saveProject(project, metadata));
ipcMain.handle('projects:history', (_e, id) => projectHistory.readHistory(db, id));
ipcMain.handle('projects:checkpoint', (_e, id, label) => {
  const project = loadProject(id); if (!project) throw new Error('Project not found.');
  projectHistory.snapshot(db, project, String(label || 'Named recovery point').slice(0, 160));
  return projectHistory.readHistory(db, id);
});
ipcMain.handle('projects:readSnapshot', (_e, projectId, id) => projectHistory.readSnapshot(db, projectId, id));
ipcMain.handle('projects:delete', (_e, id) => {
  deleteProjectRow(id);
  return true;
});

ipcMain.handle('contact:openEmail', () => require('electron').shell.openExternal('mailto:anisur.rahman.bayazid@gmail.com'));

ipcMain.handle('update:check', () => checkForUpdates(false));

ipcMain.handle('update:downloadAndInstall', async () => {
  if (process.platform !== 'win32') return false;
  autoUpdater.autoDownload = true;
  await autoUpdater.downloadUpdate();
  return true;
});

ipcMain.handle('update:quitAndInstall', () => {
  autoUpdater.quitAndInstall();
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
        original: captureOriginalSource(fs.readFileSync(fp), path.basename(fp), path.extname(fp).slice(1).toLowerCase(), text),
        sizeBytes: stat.size,
        ok: true
      });
    } catch (e) {
      out.push({ name: path.basename(fp), content: '', sizeBytes: 0, ok: false, error: String(e.message || e) });
    }
  }
  return out;
});

ipcMain.handle('docs:extractDropped', async (event, paths) => {
  if (!paths || paths.length === 0) return [];

  const out = [];
  for (const fp of paths) {
    try {
      const text = await extractText(fp);
      const stat = fs.statSync(fp);
      out.push({
        name: path.basename(fp),
        content: text,
        original: captureOriginalSource(fs.readFileSync(fp), path.basename(fp), path.extname(fp).slice(1).toLowerCase(), text),
        sizeBytes: stat.size,
        ok: true
      });
    } catch (e) {
      out.push({ 
        name: path.basename(fp), 
        content: '', 
        sizeBytes: 0, 
        ok: false, 
        error: String(e.message || e) 
      });
    }
  }
  return out;
});

ipcMain.handle('docs:saveOriginal', async (_event, original) => {
  const buffer = decodeOriginalSource(original);
  const name = `${safeFilename(path.basename(original.name, path.extname(original.name)))}.${original.format}`;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save original document', defaultPath: name,
    filters: [{ name: original.format === 'docx' ? 'Word document' : 'PDF document', extensions: [original.format] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, buffer);
  return filePath;
});

ipcMain.handle('docs:pickOriginal', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Attach an original Word or PDF file', properties: ['openFile'],
    filters: [{ name: 'Original documents', extensions: ['docx', 'pdf'] }]
  });
  if (canceled || !filePaths.length) return null;
  const file = filePaths[0];
  const text = await extractText(file);
  return captureOriginalSource(fs.readFileSync(file), path.basename(file), path.extname(file).slice(1).toLowerCase(), text);
});

ipcMain.handle('docs:openOriginal', async (_event, original) => {
  const buffer = decodeOriginalSource(original);
  const dir = fs.mkdtempSync(path.join(app.getPath('temp'), 'eqc-original-'));
  const name = `${safeFilename(path.basename(original.name, path.extname(original.name)))}.${original.format}`;
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, buffer);
  const error = await require('electron').shell.openPath(filePath);
  if (error) throw new Error(error);
});

const { imageExtensions, importImages } = require('./imageImport.cjs');
ipcMain.handle('images:pickAndEncode', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Add images', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: imageExtensions }]
  });
  return canceled ? [] : importImages(filePaths);
});
ipcMain.handle('images:extractDropped', (_event, paths) => importImages(paths));

ipcMain.handle('export:saveImage', async (_e, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: payload.title || 'Export Image',
    defaultPath: payload.defaultName,
    filters: [{ name: 'PNG image', extensions: ['png'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, Buffer.from(payload.base64, 'base64'));
  return filePath;
});

// ---------------------------------------------------------------------
// IPC: REFI-QDA (.qdpx) import
// .qdpx is a zip archive containing project.qde (REFI-QDA project XML)
// plus a Sources/ folder of referenced source files. We unzip and hand
// back raw text here; the renderer (qdpxImport.ts) parses the XML and
// merges it into the in-memory Project, same division of labor as CSV
// import.
// ---------------------------------------------------------------------
ipcMain.handle('qdpx:pickAndParse', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import REFI-QDA project (.qdpx)',
    properties: ['openFile'],
    filters: [{ name: 'REFI-QDA project or codebook', extensions: ['qdpx', 'qdc', 'qde'] }]
  });
  if (canceled || filePaths.length === 0) return null;

  return require('./projectExchange.cjs').readExchangeFile(filePaths[0]);
});

// IPC: REFI-QDA (.qdpx) export. The renderer (qdpxExport.ts) builds the
// project.qde XML plus a map of source files / binary payloads; we zip them
// into a .qdpx archive at a user-chosen location. Mirror of the import flow.
ipcMain.handle('qdpx:export', async (_e, { fileName, qdeXml, sourceFiles, sourceBytes }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export REFI-QDA project (.qdpx)',
    defaultPath: fileName || 'project.qdpx',
    filters: [{ name: 'REFI-QDA project', extensions: ['qdpx'] }]
  });
  if (canceled || !filePath) return null;

  const zip = new JSZip();
  zip.file('project.qde', qdeXml);
  for (const [name, content] of Object.entries(sourceFiles || {})) {
    zip.file(name, content);
  }
  for (const [name, base64] of Object.entries(sourceBytes || {})) {
    if (base64) zip.file(name, Buffer.from(base64, 'base64'));
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(filePath, buffer);
  return filePath;
});

// ---------------------------------------------------------------------
// IPC: export a document as a .docx file
// ---------------------------------------------------------------------


function contentToParagraphs(content) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun } = require('docx');
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
  const {Document,Packer}=require('docx');
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
    defaultPath: `${safeFilename(String(defaultName).endsWith('.'+extension) ? String(defaultName).slice(0,-extension.length-1) : defaultName)}.${extension}`,
    filters: [{ name: filterName || 'File', extensions: [extension || 'txt'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
});

// ---------------------------------------------------------------------
// IPC: generic .docx export — either a flat table or a codebook outline
// ---------------------------------------------------------------------
function buildTableDocx(title, headers, rows, imageCells = []) {
  const images = new Map(imageCells.map(cell => [`${cell.row}:${cell.column}`, cell]));
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })]
    }))
  });
  const dataRows = rows.map((r, row) => new TableRow({
    children: r.map((cell, column) => {
      const image = images.get(`${row}:${column}`);
      const children = [new Paragraph(String(cell ?? ''))];
      if (image) {
        const scale = Math.min(1, 180 / image.width, 180 / image.height);
        children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: Buffer.from(image.base64, 'base64'),
          transformation: { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) } })] }));
      }
      return new TableCell({ children });
    })
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
    // Coding definition first — it is the operational rule for applying the
    // code, so it belongs directly under the heading. Memo/summary follows.
    if (node.definition) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'Definition: ', bold: true }),
          new TextRun({ text: node.definition })
        ],
        indent: { left: 360 * (node.depth + 1) }
      }));
    }
    if (node.summary) {
      children.push(new Paragraph({ text: node.summary, indent: { left: 360 * (node.depth + 1) } }));
    }
    for (const q of node.quotes || []) {
      children.push(new Paragraph({ children: [new TextRun({ text: q, italics: true })],
        indent: { left: 360 * (node.depth + 1) + 180 }, spacing: { after: 80 } }));
    }
    for (const iq of node.imageQuotes || []) {
      const scale = Math.min(1, 300 / iq.width, 300 / iq.height);
      children.push(new Paragraph({ indent: { left: 360 * (node.depth + 1) + 180 },
        children: [new ImageRun({ type: 'png', data: Buffer.from(iq.base64, 'base64'),
          transformation: { width: Math.max(1, Math.round(iq.width * scale)), height: Math.max(1, Math.round(iq.height * scale)) } })] }));
      children.push(new Paragraph({ text: iq.caption, indent: { left: 360 * (node.depth + 1) + 180 }, spacing: { after: 120 } }));
    }
  }
  return new Document({ sections: [{ children }] });
}

function buildImageGalleryDocx(title, items) {
  const children = [new Paragraph({ text: title, heading: HeadingLevel.TITLE })];
  for (const item of items) {
    const buffer = Buffer.from(item.base64, 'base64');
    const maxWidth = 400;
    const scale = item.width > maxWidth ? maxWidth / item.width : 1;
    children.push(new Paragraph({
      children: [new ImageRun({ data: buffer, transformation: { width: Math.round(item.width * scale), height: Math.round(item.height * scale) } })]
    }));
    children.push(new Paragraph({ text: item.caption, spacing: { after: 200 } }));
  }
  return new Document({ sections: [{ children }] });
}

ipcMain.handle('export:docx', async (_e, payload) => {
  const {Packer}=require('docx');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as Word file',
    defaultPath: `${safeFilename(payload.filenameBase)}.docx`,
    filters: [{ name: 'Word document', extensions: ['docx'] }]
  });
  if (canceled || !filePath) return null;

  const doc = payload.kind === 'codeReport'
    ? buildCodeReportDocx(payload)
    : payload.kind === 'outline'
    ? buildOutlineDocx(payload.title, payload.outline)
    : payload.kind === 'imageGallery'
    ? buildImageGalleryDocx(payload.title, payload.items)
    : buildTableDocx(payload.title, payload.headers, payload.rows, payload.imageCells);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return filePath;
});


// ---------------------------------------------------------------------
// IPC: coded-DOCX import (Word comments encode codes)
// A .docx is a zip archive; comment ranges live in word/document.xml
// (commentRangeStart/End markers) and comment text lives in
// word/comments.xml. We hand both raw XML strings to the renderer, same
// division of labor as .qdpx import — main process just unzips.
// ---------------------------------------------------------------------
ipcMain.handle('docxComments:pickAndParse', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Coded Word Document (comments as codes)',
    properties: ['openFile'],
    filters: [{ name: 'Word document', extensions: ['docx'] }]
  });
  if (canceled || filePaths.length === 0) return null;

  const buffer = fs.readFileSync(filePaths[0]);
  const zip = await JSZip.loadAsync(buffer);

  const documentEntry = zip.file('word/document.xml');
  const commentsEntry = zip.file('word/comments.xml');
  if (!documentEntry) {
    throw new Error('This file does not look like a valid .docx (missing word/document.xml).');
  }

  const documentXml = await documentEntry.async('string');
  const commentsXml = commentsEntry ? await commentsEntry.async('string') : '';

  return {
    fileName: path.basename(filePaths[0]),
    documentXml,
    commentsXml,
    originalBase64: buffer.toString('base64')
  };
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

  // Definition columns (coding definitions for the codebook): a bare
  // "definition" / "code definition" / "coding definition" header, anything
  // starting with "definition of", or anything ending "definition".
  const definitionFields = fields.filter(
    f => f.norm === 'definition' || f.norm === 'code definition' || f.norm === 'coding definition' ||
      f.norm.startsWith('definition of') || f.norm.endsWith('definition')
  );

  return {
    fileName: path.basename(filePaths[0]),
    columns,
    summaryFields: summaryFields.map(f => f.raw),
    definitionFields: definitionFields.map(f => f.raw),
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
    title: 'Import project or codebook',
    properties: ['openFile'],
    filters: [{ name: 'eQc / REFI-QDA project or codebook', extensions: ['json', 'qdpx', 'qdc', 'qde'] }]
  });
  if (canceled || !filePaths.length) return null;
  if (!/\.json$/i.test(filePaths[0])) return { format: 'refi', payload: await require('./projectExchange.cjs').readExchangeFile(filePaths[0]) };
  const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'));
  if (!data || typeof data.name !== 'string' || !Array.isArray(data.docs) || !Array.isArray(data.codes) || !Array.isArray(data.codedSegments)) throw new Error('This JSON file is not an eQc project backup.');
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
