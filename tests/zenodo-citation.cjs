'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { supportedTag, matchingRecord, updateTexts, run } = require('../.github/scripts/sync-zenodo-citation.cjs');

const repository = 'example/eqc';
const tag = 'v1.8.6';
const dois = { doi: '10.5281/zenodo.12345', conceptdoi: '10.5281/zenodo.12344' };
const record = () => ({ ...dois, status: 'published', metadata: { version: '1.8.6',
  resource_type: { type: 'software' }, related_identifiers: [{ relation: 'isSupplementTo',
    identifier: `https://github.com/${repository}/tree/${tag}` }] } });
const cff = 'cff-version: 1.2.0\nversion: 1.8.6\ndate-released: "2026-11-01"\nauthors:\n  - family-names: Researcher\n';
const readme = '[![DOI](https://img.shields.io/badge/DOI-placeholder)](https://github.com/example/eqc/releases/latest)\n\nIf you use eQc in published work, please cite it.\n\nOther content.\n';

test('only stable releases from v1.8.6 onward are eligible', () => {
  for (const value of ['v1.8.6', 'v1.8.10', 'v1.9.0', 'v2.0.0']) assert.ok(supportedTag(value));
  for (const value of ['v1.8.5', 'v1.7.99', 'v0.9.0', 'v1.8.6-beta', 'main', '1.8.6']) assert.ok(!supportedTag(value));
});

test('requires exact repository/tag, software type, published status and version', () => {
  assert.deepEqual(matchingRecord([record()], repository, tag), dois);
  for (const mutate of [
    r => { r.status = 'draft'; },
    r => { r.metadata.version = '1.8.5'; },
    r => { r.metadata.resource_type.type = 'dataset'; },
    r => { r.metadata.related_identifiers[0].identifier += '-other'; },
    r => { r.metadata.related_identifiers[0].relation = 'references'; },
  ]) {
    const wrong = record(); mutate(wrong);
    assert.equal(matchingRecord([wrong], repository, tag), null);
  }
  assert.equal(matchingRecord([record()], 'someone/else', tag), null);
  assert.throws(() => matchingRecord([record(), record()], repository, tag), /Multiple/);
  assert.throws(() => matchingRecord([{ ...record(), conceptdoi: undefined }], repository, tag), /DOI metadata/);
});

test('writes version DOI to CFF and concept badge to README, idempotently', () => {
  const result = updateTexts(cff, readme, tag, dois);
  assert.match(result.cff, /doi: "10\.5281\/zenodo\.12345"/);
  assert.ok(result.cff.includes('date-released: "2026-11-01"'));
  assert.match(result.readme, /badge\/DOI\/10\.5281\/zenodo\.12344.svg/);
  assert.match(result.readme, /Archived release \*\*v1.8.6\*\*/);
  assert.ok(result.readme.endsWith('Other content.\n'));
  assert.deepEqual(updateTexts(result.cff, result.readme, tag, dois), result);
  assert.throws(() => updateTexts(cff.replace('1.8.6', '1.8.7'), readme, tag, dois), /version differs/);
  assert.throws(() => updateTexts(cff, 'no badge', tag, dois), /badge/);
});

test('replaces the previous DOI and preserves Windows line endings', () => {
  const previous = cff.replace('version: 1.8.6', 'version: 1.8.6\ndoi: "10.5281/zenodo.11111"');
  const result = updateTexts(previous.replaceAll('\n', '\r\n'), readme.replaceAll('\n', '\r\n'), tag, dois);
  assert.equal((result.cff.match(/^doi:/gm) || []).length, 1);
  assert.ok(!result.cff.replaceAll('\r\n', '').includes('\n'));
  assert.ok(!result.readme.replaceAll('\r\n', '').includes('\n'));
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eqc-doi-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'CITATION.cff'), cff);
  fs.writeFileSync(path.join(root, 'README.md'), readme);
  return root;
}
const response = data => ({ ok: true, json: async () => data });
const release = { tag_name: tag, draft: false, prerelease: false };

test('waits for indexing, isolates GitHub credentials, then updates both files', async t => {
  const root = fixture(t); let searches = 0; let waits = 0;
  const result = await run({ root, env: { GITHUB_REPOSITORY: repository, GITHUB_TOKEN: 'test-only' },
    attempts: 2, sleep: async () => { waits++; }, log: () => {},
    fetchFn: async (url, options) => {
      if (url.startsWith('https://api.github.com/')) {
        assert.equal(options.headers.Authorization, 'Bearer test-only'); return response(release);
      }
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(new URL(url).searchParams.get('q'), `related.identifier:"https://github.com/${repository}/tree/${tag}"`);
      return response({ hits: { hits: ++searches === 1 ? [] : [record()] } });
    } });
  assert.deepEqual(result, dois); assert.equal(waits, 1);
  assert.match(fs.readFileSync(path.join(root, 'CITATION.cff'), 'utf8'), /zenodo.12345/);
});

test('timeout leaves both files unchanged', async t => {
  const root = fixture(t);
  await assert.rejects(run({ root, env: { GITHUB_REPOSITORY: repository }, attempts: 1, log: () => {},
    fetchFn: async url => response(url.includes('api.github.com') ? release : { hits: { hits: [] } }),
  }), /not available yet/);
  assert.equal(fs.readFileSync(path.join(root, 'CITATION.cff'), 'utf8'), cff);
  assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), readme);
});

test('malformed metadata fails without partially updating files', async t => {
  const root = fixture(t);
  await assert.rejects(run({ root, env: { GITHUB_REPOSITORY: repository }, log: () => {},
    fetchFn: async url => response(url.includes('api.github.com') ? release :
      { hits: { hits: [{ ...record(), doi: 'not-a-doi' }] } }),
  }), /DOI metadata/);
  assert.equal(fs.readFileSync(path.join(root, 'CITATION.cff'), 'utf8'), cff);
  assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), readme);
});

test('temporary API rate limits retry without sending credentials to Zenodo', async t => {
  const root = fixture(t); let searches = 0;
  await run({ root, env: { GITHUB_REPOSITORY: repository }, attempts: 2, sleep: async () => {}, log: () => {},
    fetchFn: async url => {
      if (url.includes('api.github.com')) return response(release);
      if (++searches === 1) return { ok: false, status: 429 };
      return response({ hits: { hits: [record()] } });
    },
  });
  assert.equal(searches, 2);
  assert.match(fs.readFileSync(path.join(root, 'CITATION.cff'), 'utf8'), /zenodo.12345/);
});

test('stale build, old/manual tag, and development citation do not query Zenodo', async t => {
  const root = fixture(t);
  const eventPath = path.join(root, 'event.json');
  fs.writeFileSync(eventPath, JSON.stringify({ workflow_run: { head_sha: 'old' } }));
  const fetchFn = async url => {
    assert.ok(url.startsWith('https://api.github.com/'));
    return response(url.includes('/commits/') ? { sha: 'new' } : release);
  };
  await run({ root, env: { GITHUB_REPOSITORY: repository, GITHUB_EVENT_PATH: eventPath }, fetchFn, log: () => {} });
  await run({ root, env: { GITHUB_REPOSITORY: repository, RELEASE_TAG: 'v1.8.5' }, fetchFn, log: () => {} });
  fs.writeFileSync(path.join(root, 'CITATION.cff'), cff.replace('1.8.6', '1.8.7'));
  await run({ root, env: { GITHUB_REPOSITORY: repository }, fetchFn, log: () => {} });
  assert.equal(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), readme);
});

test('a newer release appearing during the wait prevents citation writes', async t => {
  const root = fixture(t); let requests = 0;
  await assert.rejects(run({ root, env: { GITHUB_REPOSITORY: repository }, log: () => {},
    fetchFn: async url => {
      if (url.startsWith('https://api.github.com/')) return response(++requests === 1 ? release : { ...release, tag_name: 'v1.8.7' });
      return response({ hits: { hits: [record()] } });
    } }), /newer release/);
  assert.equal(fs.readFileSync(path.join(root, 'CITATION.cff'), 'utf8'), cff);
});
