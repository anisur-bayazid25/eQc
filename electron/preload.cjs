const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qv', {
  // Projects
  listProjects: () => ipcRenderer.invoke('projects:list'),
  loadProject: id => ipcRenderer.invoke('projects:load', id),
  saveProject: project => ipcRenderer.invoke('projects:save', project),
  deleteProject: id => ipcRenderer.invoke('projects:delete', id),

  // Documents
  pickAndExtractDocs: () => ipcRenderer.invoke('docs:pickAndExtract'),
  pickAndParseDocxComments: () => ipcRenderer.invoke('docxComments:pickAndParse'),
  exportDocAsDocx: (payload) => ipcRenderer.invoke('docs:exportDocx', payload),
  exportText: (payload) => ipcRenderer.invoke('export:saveText', payload),
  exportDocxTable: (payload) => ipcRenderer.invoke('export:docx', payload),
  exportImage: (payload) => ipcRenderer.invoke('export:saveImage', payload),

  // CSV dataset import
  pickAndParseCsv: () => ipcRenderer.invoke('csv:pickAndParse'),

  pickAndEncodeImages: () => ipcRenderer.invoke('images:pickAndEncode'),

  // Backup / merge
  exportBackup: project => ipcRenderer.invoke('backup:export', project),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  pickMultipleForMerge: () => ipcRenderer.invoke('backup:pickMultipleForMerge'),

  // Report
  exportReport: (project, html) => ipcRenderer.invoke('report:export', { project, html }),

  // REFI-QDA import
  pickAndParseQdpx: () => ipcRenderer.invoke('qdpx:pickAndParse')
});
