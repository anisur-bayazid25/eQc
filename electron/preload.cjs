const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qv', {
  // Projects
  listProjects: () => ipcRenderer.invoke('projects:list'),
  loadProject: id => ipcRenderer.invoke('projects:load', id),
  saveProject: project => ipcRenderer.invoke('projects:save', project),
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
    startHost: (config) => ipcRenderer.invoke('lan:startHost', config),
    stopHost: () => ipcRenderer.invoke('lan:stopHost'),
    startDiscovery: () => ipcRenderer.invoke('lan:startDiscovery'),
    stopDiscovery: () => ipcRenderer.invoke('lan:stopDiscovery'),
    pingHost: (ip) => ipcRenderer.invoke('lan:pingHost', ip),
    joinSession: (credentials) => ipcRenderer.invoke('lan:joinSession', credentials),
    disconnectSession: () => ipcRenderer.invoke('lan:disconnectSession'),
    sendAction: (payload) => ipcRenderer.invoke('lan:sendAction', payload),
    onHostsUpdated: (cb) => ipcRenderer.on('lan:hostsUpdated', (_e, hosts) => cb(hosts)),
    onSessionState: (cb) => ipcRenderer.on('lan:sessionState', (_e, s) => cb(s)),
    onSyncProgress: (cb) => ipcRenderer.on('lan:syncProgress', (_e, p) => cb(p)),
    onRemoteProject: (cb) => ipcRenderer.on('lan:remoteProject', (_e, r) => cb(r))
  }
});
