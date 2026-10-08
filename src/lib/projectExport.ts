import { Project } from '../domain';

/** Export projection: omit retained document binaries without changing live data or coding. */
export function projectForExport(project: Project, includeOriginals: boolean): Project {
  if (includeOriginals) return project;
  return { ...project, docs: project.docs.map(({ original: _original, ...doc }) => doc) };
}
