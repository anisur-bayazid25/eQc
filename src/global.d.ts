/// <reference types="vite/client" />

declare module 'pdfjs-dist/build/pdf.worker.min.js?url' {
  const url: string;
  export default url;
}

declare module '*.js?url' {
  const url: string;
  export default url;
}

import type { Project, ProjectSummary } from './domain';

export interface ExtractedDoc {
  name: string;
  content: string;
  sizeBytes: number;
  ok: boolean;
  error?: string;
}

export interface CsvColumns {
  source: string | null;
  quote: string | null;
  parent: string | null;
  child1: string | null;
  child2: string | null;
}

export interface CsvParseResult {
  fileName: string;
  columns: CsvColumns;
  summaryFields: string[];
  rows: Record<string, string>[];
  errors: unknown[];
}

interface QdpxParsePayload {
  fileName: string;
  qdeXml: string;
  sourceFiles: Record<string, string>;
}

export interface QvBridge {
  listProjects(): Promise<ProjectSummary[]>;
  loadProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;

  pickAndExtractDocs(): Promise<ExtractedDoc[]>;
  pickAndParseCsv(): Promise<CsvParseResult | null>;
  pickAndParseQdpx: () => Promise<QdpxParsePayload | null>;

  exportBackup(project: Project): Promise<string | null>;
  importBackup(): Promise<Project | null>;
  pickMultipleForMerge(): Promise<Project[]>;

  exportDocAsDocx(payload: { name: string; content: string }): Promise<string | null>;
  
  exportText(payload: { title: string; defaultName: string; content: string; extension: string; filterName: string }): Promise<string | null>;
  exportDocxTable(payload: {
  kind: 'table' | 'outline';
  title: string;
  headers?: string[];
  rows?: string[][];
  outline?: { depth: number; name: string; summary?: string }[];
  filenameBase: string;
}): Promise<string | null>;

  exportReport(project: Project, html: string): Promise<string | null>;
}

declare global {
  interface Window {
    qv: QvBridge;
  }
}
