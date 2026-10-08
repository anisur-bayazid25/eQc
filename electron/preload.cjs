const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qv', {
  openContactEmail: () => ipcRenderer.invoke('contact:openEmail'),
  profileTime: {
    open: legacy => ipcRenderer.invoke('profiles:open',legacy),
    write: payload => ipcRenderer.invoke('profiles:write',payload),
    select: id => ipcRenderer.invoke('profiles:select',id),
    create: () => ipcRenderer.invoke('profiles:create'),
    delete: id => ipcRenderer.invoke('profiles:delete',id),
    backup: id => ipcRenderer.invoke('profiles:backup',id),
    validate: backup => ipcRenderer.invoke('profiles:validate',backup),
    import: backup => ipcRenderer.invoke('profiles:import',backup),
    flushOnExit: payload => ipcRenderer.send('profiles:flush',payload),
    onPrepareClose: callback => {const listener=()=>callback();ipcRenderer.on('profiles:prepareClose',listener);return()=>ipcRenderer.removeListener('profiles:prepareClose',listener);},
    completeClose: result => ipcRenderer.send('profiles:closeReady',result),
  },
  // Projects
  listProjects: () => ipcRenderer.invoke('projects:list'),
  loadProject: id => ipcRenderer.invoke('projects:load', id),
  saveProject: (project, metadata) => ipcRenderer.invoke('projects:save', project, metadata),
  projectHistory: id => ipcRenderer.invoke('projects:history', id),
  createCheckpoint: (id, label) => ipcRenderer.invoke('projects:checkpoint', id, label),
  readSnapshot: (projectId, id) => ipcRenderer.invoke('projects:readSnapshot', projectId, id),
  deleteProject: id => ipcRenderer.invoke('projects:delete', id),

// Updates
checkForUpdates: () => ipcRenderer.invoke('update:check'),
downloadAndInstallUpdate: () => ipcRenderer.invoke('update:downloadAndInstall'),
quitAndInstallUpdate: () => ipcRenderer.invoke('update:quitAndInstall'),
onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_e, info) => cb(info)),
onUpdateNone: (cb) => ipcRenderer.on('update:none', () => cb()),
onUpdateError: (cb) => ipcRenderer.on('update:error', (_e, msg) => cb(msg)),
onUpdateReady: (cb) => ipcRenderer.on('update:ready', () => cb()),
onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_e, pct) => cb(pct)),

  // Documents
  pickAndExtractDocs: () => ipcRenderer.invoke('docs:pickAndExtract'),
  openOriginalSource: (original) => ipcRenderer.invoke('docs:openOriginal', original),
  pickOriginalSource: () => ipcRenderer.invoke('docs:pickOriginal'),
  saveOriginalSource: (original) => ipcRenderer.invoke('docs:saveOriginal', original),
  extractDroppedDocs: (paths) => ipcRenderer.invoke('docs:extractDropped', paths),
  pickAndParseDocxComments: () => ipcRenderer.invoke('docxComments:pickAndParse'),
  exportDocAsDocx: (payload) => ipcRenderer.invoke('docs:exportDocx', payload),
  exportText: (payload) => ipcRenderer.invoke('export:saveText', payload),
  exportDocxTable: (payload) => ipcRenderer.invoke('export:docx', payload),
  exportImage: (payload) => ipcRenderer.invoke('export:saveImage', payload),

  // CSV dataset import
  pickAndParseCsv: () => ipcRenderer.invoke('csv:pickAndParse'),

  pickAndEncodeImages: () => ipcRenderer.invoke('images:pickAndEncode'),
  extractDroppedImages: (paths) => ipcRenderer.invoke('images:extractDropped', paths),

  // Backup / merge
  exportBackup: project => ipcRenderer.invoke('backup:export', project),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  pickMultipleForMerge: () => ipcRenderer.invoke('backup:pickMultipleForMerge'),

  // Report
  exportReport: (project, html) => ipcRenderer.invoke('report:export', { project, html }),

  // REFI-QDA import
  pickAndParseQdpx: () => ipcRenderer.invoke('qdpx:pickAndParse'),

  // REFI-QDA export
  exportQdpx: (payload) => ipcRenderer.invoke('qdpx:export', payload),

  // LAN collaboration (host discovery, WebSocket sessions, live sync)
  lan: {
    updateName: (name) => ipcRenderer.invoke('lan:updateName', name),
    startHost: (config) => ipcRenderer.invoke('lan:startHost', config),
    stopHost: () => ipcRenderer.invoke('lan:stopHost'),
    kickClient: (clientId) => ipcRenderer.invoke('lan:kickClient', clientId),
    startDiscovery: () => ipcRenderer.invoke('lan:startDiscovery'),
    stopDiscovery: () => ipcRenderer.invoke('lan:stopDiscovery'),
    pingHost: (ip) => ipcRenderer.invoke('lan:pingHost', ip),
    joinSession: (credentials) => ipcRenderer.invoke('lan:joinSession', credentials),
    disconnectSession: () => ipcRenderer.invoke('lan:disconnectSession'),
    sendAction: (payload) => ipcRenderer.invoke('lan:sendAction', payload),
    setActiveDoc: (docId) => ipcRenderer.invoke('lan:setActiveDoc', docId),
    onHostsUpdated: (cb) => ipcRenderer.on('lan:hostsUpdated', (_e, hosts) => cb(hosts)),
    onSessionState: (cb) => ipcRenderer.on('lan:sessionState', (_e, s) => cb(s)),
    onSyncProgress: (cb) => ipcRenderer.on('lan:syncProgress', (_e, p) => cb(p)),
    onRemoteProject: (cb) => ipcRenderer.on('lan:remoteProject', (_e, r) => cb(r)),
    onRejected: (cb) => ipcRenderer.on('lan:rejected', (_e, r) => cb(r))
  }
});
