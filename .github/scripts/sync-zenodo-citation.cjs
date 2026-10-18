'use strict';

// Zenodo publishes the archive; this script only reads public records and updates
// the default branch's citation. It never uploads, publishes, or changes a tag.
const fs = require('node:fs');
const path = require('node:path');

const normalizeVersion = value => String(value || '').replace(/^v/, '');
function supportedTag(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag || '');
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 1 || (major === 1 && (minor > 8 || (minor === 8 && patch >= 6)));
}
function scalar(text, key) {
  const value = text.match(new RegExp(`^${key}:\\s*([^\\r\\n]+)`, 'm'))?.[1]?.trim();
  return value?.replace(/^["']|["']$/g, '');
}
function matchingRecord(records, repository, tag) {
  const expected = `https://github.com/${repository}/tree/${tag}`;
  const matches = records.filter(record =>
    record.status === 'published' &&
    record.metadata?.resource_type?.type === 'software' &&
    normalizeVersion(record.metadata?.version) === normalizeVersion(tag) &&
    record.metadata?.related_identifiers?.some(link =>
      link.relation === 'isSupplementTo' && link.identifier?.replace(/\/$/, '') === expected));
  if (matches.length > 1) throw new Error('Multiple matching Zenodo records; inspect the archives before retrying.');
  if (!matches.length) return null;
  const record = matches[0];
  const doi = record.doi || record.metadata.doi;
  const conceptdoi = record.conceptdoi;
  for (const value of [doi, conceptdoi]) {
    if (!/^10\.5281\/zenodo\.\d+$/.test(value || '')) {
      throw new Error('Matching record has missing or unexpected Zenodo DOI metadata.');
    }
  }
  if (doi === conceptdoi) throw new Error('Version and concept DOI must be distinct.');
  return { doi, conceptdoi };
}
function updateTexts(cff, readme, tag, record) {
  if (scalar(cff, 'version') !== normalizeVersion(tag)) {
    throw new Error('CITATION.cff version differs from this release; refusing to attach the wrong DOI.');
  }
  const eol = cff.includes('\r\n') ? '\r\n' : '\n';
  const doiLine = `doi: "${record.doi}"`;
  const citation = /^doi:/m.test(cff)
    ? cff.replace(/^doi:[^\r\n]*/m, doiLine)
    : cff.replace(/^(version:[^\r\n]*)/m, `$1${eol}${doiLine}`);
  const badge = `[![DOI](https://zenodo.org/badge/DOI/${record.conceptdoi}.svg)](https://doi.org/${record.conceptdoi})`;
  const badgePattern = /\[!\[DOI\]\([^\r\n]*?\)\]\([^\r\n]*?\)/;
  if (!badgePattern.test(readme)) throw new Error('README DOI badge was not found.');
  let updated = readme.replace(badgePattern, badge);
  const block = [
    '<!-- zenodo-citation:start -->',
    `Archived release **${tag}**: [${record.doi}](https://doi.org/${record.doi}). Use this version DOI when citing this release.`,
    `The [all-versions DOI](https://doi.org/${record.conceptdoi}) above opens the latest archived release.`,
    '<!-- zenodo-citation:end -->',
  ].join(readme.includes('\r\n') ? '\r\n' : '\n');
  const blockPattern = /<!-- zenodo-citation:start -->[\s\S]*?<!-- zenodo-citation:end -->/;
  if (blockPattern.test(updated)) updated = updated.replace(blockPattern, block);
  else {
    const anchor = /^If you use eQc in published work,[^\r\n]*/m;
    if (!anchor.test(updated)) throw new Error('README citation paragraph was not found.');
    const newline = readme.includes('\r\n') ? '\r\n' : '\n';
    updated = updated.replace(anchor, line => `${line}${newline}${newline}${block}`);
  }
  return { cff: citation, readme: updated };
}

async function run({ env = process.env, fetchFn = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  root = process.cwd(), attempts = 30, interval = 60000, log = console.log } = {}) {
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('GITHUB_REPOSITORY must identify owner/repository.');
  const event = env.GITHUB_EVENT_PATH ? JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) : {};
  async function json(url, github = false) {
    const headers = { Accept: 'application/json', 'User-Agent': 'eQc-citation-sync' };
    if (github && env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const response = await fetchFn(url, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      const error = new Error(`Metadata request returned HTTP ${response.status}.`);
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }
    return response.json();
  }
  const api = `https://api.github.com/repos/${repository}`;
  const latest = await json(`${api}/releases/latest`, true);
  const tag = env.RELEASE_TAG || latest.tag_name;
  if (!supportedTag(tag) || tag !== latest.tag_name || latest.draft || latest.prerelease) {
    log('Skipped: only the latest stable release, starting with v1.8.6, can update the citation.');
    return;
  }
  if (event.workflow_run) {
    const commit = await json(`${api}/commits/${encodeURIComponent(tag)}`, true);
    if (commit.sha !== event.workflow_run.head_sha) {
      log('Skipped: the completed build does not belong to the latest release.');
      return;
    }
  }
  const cffPath = path.join(root, 'CITATION.cff');
  const readmePath = path.join(root, 'README.md');
  const cff = fs.readFileSync(cffPath, 'utf8');
  if (scalar(cff, 'version') !== normalizeVersion(tag)) {
    log('Skipped: the default branch citation has moved to a different version.');
    return;
  }
  const query = `related.identifier:"https://github.com/${repository}/tree/${tag}"`;
  const url = `https://zenodo.org/api/records/?${new URLSearchParams({ q: query, all_versions: 'true', size: '25' })}`;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let record;
    try {
      const result = await json(url);
      record = matchingRecord(result.hits?.hits || [], repository, tag);
    } catch (error) {
      // A temporary network/server failure is safe to retry; invalid metadata is not.
      if (!error.retryable && !(error instanceof TypeError) && error.name !== 'TimeoutError') throw error;
      log(`Zenodo temporarily unavailable (${attempt + 1}/${attempts}).`);
    }
    if (record) {
      // Recheck latest release after waiting, before writing either local file.
      const current = await json(`${api}/releases/latest`, true);
      if (current.tag_name !== tag) throw new Error('A newer release appeared; rerun for the latest release.');
      const updated = updateTexts(cff, fs.readFileSync(readmePath, 'utf8'), tag, record);
      fs.writeFileSync(cffPath, updated.cff);
      fs.writeFileSync(readmePath, updated.readme);
      const message = `Synced ${tag}: version DOI ${record.doi}; all-versions DOI ${record.conceptdoi}.`;
      log(message);
      if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${message}\n`);
      return record;
    }
    log(`Waiting for Zenodo to publish/index ${tag} (${attempt + 1}/${attempts}).`);
    if (attempt + 1 < attempts) await sleep(interval);
  }
  throw new Error('Zenodo DOI is not available yet. Check its GitHub integration for errors, then rerun Sync Zenodo citation from GitHub Actions. No files were changed.');
}

module.exports = { supportedTag, matchingRecord, updateTexts, run };
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
