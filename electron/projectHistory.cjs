const crypto = require('node:crypto');

const collections = { docs: 'source', images: 'image', codes: 'code', codedSegments: 'text coding', codedRegions: 'region coding', cases: 'case', groups: 'group', annotations: 'annotation', memos: 'memo', queries: 'saved query', frameworkCells: 'framework summary', relationNotes: 'relationship memo' };
function summarizeChanges(before, after) {
  if (!before) return ['Project created'];
  const changes = [];
  if (before.name !== after.name) changes.push('Project renamed');
  for (const [key, label] of Object.entries(collections)) {
    const old = new Map((before[key] || []).map(x => [x.id, x]));
    const next = new Map((after[key] || []).map(x => [x.id, x]));
    let added = 0, removed = 0, edited = 0;
    for (const [id, value] of next) {
      if (!old.has(id)) added++;
      else if (JSON.stringify(old.get(id)) !== JSON.stringify(value)) edited++;
    }
    for (const id of old.keys()) if (!next.has(id)) removed++;
    for (const [count, action] of [[added, 'added'], [removed, 'removed'], [edited, 'updated']]) if (count) changes.push(`${count} ${label}${count > 1 && !label.endsWith('s') ? 's' : ''} ${action}`);
  }
  if (!changes.length) {
    const omit = p => Object.fromEntries(Object.entries(p).filter(([k]) => !['updatedAt', ...Object.keys(collections)].includes(k)));
    if (JSON.stringify(omit(before)) !== JSON.stringify(omit(after))) changes.push('Project settings or map updated');
  }
  return changes;
}
function installHistory(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS project_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, at INTEGER NOT NULL, actor TEXT NOT NULL, summary TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS activity_project ON project_activity(project_id, id);
    CREATE TABLE IF NOT EXISTS project_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, at INTEGER NOT NULL, label TEXT NOT NULL, automatic INTEGER NOT NULL, data TEXT NOT NULL, digest TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS snapshots_project ON project_snapshots(project_id, id);`);
}
function snapshot(db, project, label, automatic = false, at = Date.now()) {
  const data = JSON.stringify(project), digest = crypto.createHash('sha256').update(data).digest('hex');
  db.prepare('INSERT INTO project_snapshots(project_id,at,label,automatic,data,digest) VALUES (?,?,?,?,?,?)').run(project.id, at, label, automatic ? 1 : 0, data, digest);
  // Automatic snapshots rotate; explicitly named checkpoints are retained.
  db.prepare('DELETE FROM project_snapshots WHERE project_id=? AND automatic=1 AND id NOT IN (SELECT id FROM project_snapshots WHERE project_id=? AND automatic=1 ORDER BY id DESC LIMIT 10)').run(project.id, project.id);
}
function recordSave(db, before, after, metadata = {}, at = Date.now()) {
  const changes = summarizeChanges(before, after);
  if (!changes.length) return;
  if (before) {
    const latest = db.prepare('SELECT at FROM project_snapshots WHERE project_id=? ORDER BY id DESC LIMIT 1').get(after.id);
    if (!latest || at - latest.at >= 10 * 60 * 1000) snapshot(db, before, 'Automatic recovery point', true, at);
  }
  const actor = String(metadata.actor || after.coderName || 'Unspecified').slice(0, 120);
  const prefix = metadata.action ? `${String(metadata.action).slice(0, 160)}: ` : '';
  db.prepare('INSERT INTO project_activity(project_id,at,actor,summary) VALUES (?,?,?,?)').run(after.id, at, actor, prefix + changes.join('; '));
  db.prepare('DELETE FROM project_activity WHERE project_id=? AND id NOT IN (SELECT id FROM project_activity WHERE project_id=? ORDER BY id DESC LIMIT 5000)').run(after.id, after.id);
}
function readHistory(db, id) {
  return {
    activity: db.prepare('SELECT id,at,actor,summary FROM project_activity WHERE project_id=? ORDER BY id DESC LIMIT 5000').all(id),
    snapshots: db.prepare('SELECT id,at,label,automatic,length(CAST(data AS BLOB)) as sizeBytes FROM project_snapshots WHERE project_id=? ORDER BY id DESC').all(id).map(s => ({ ...s, automatic: !!s.automatic }))
  };
}
function readSnapshot(db, projectId, id) {
  const row = db.prepare('SELECT data,digest FROM project_snapshots WHERE project_id=? AND id=?').get(projectId, id);
  if (!row) throw new Error('Recovery point no longer exists.');
  if (crypto.createHash('sha256').update(row.data).digest('hex') !== row.digest) throw new Error('Recovery point failed its integrity check.');
  return JSON.parse(row.data);
}
module.exports = { installHistory, summarizeChanges, recordSave, snapshot, readHistory, readSnapshot };
