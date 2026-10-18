# Release DOI and citation automation

Zenodo's built-in GitHub integration archives new releases of
`anisur-bayazid25/eQc`. Keep the repository switch enabled in Zenodo. No Zenodo
API token or additional upload service is needed for this citation sync.

The separate **Sync Zenodo citation** workflow runs after a successful
**Build and Release eQc** workflow. This also works when GitHub Actions creates
the release using `GITHUB_TOKEN`, which does not trigger another workflow's
`release: published` event. Both workflow files must be on the default branch
before the next release. This setup starts with v1.8.6; it does not archive or
assign a DOI to v1.8.5.

## Before publishing the next release

1. Update the application version, README version, `CITATION.cff` version and
   release date as part of normal release preparation. Remove the previous
   top-level `doi:` line from `CITATION.cff` when changing its version: a previous
   release's DOI must not describe the new version. Leave the all-versions README
   badge in place once it exists; remove the marked version-specific README
   citation block while preparing a new version until its DOI is available.
2. Push the release changes to the default branch, then publish the version tag
   using the normal build/release process. No app release is created by this
   citation workflow.
3. Zenodo processes the new release independently. The citation workflow reads
   its public API once a minute for about 30 minutes, checking the exact GitHub
   repository/tag link, software record type, published status and version.
4. Once found, the workflow commits only `CITATION.cff` and `README.md` to the
   default branch. It puts the version DOI in CFF and the README citation, and
   the permanent all-versions DOI in the badge. It never modifies the release
   tag or installers. The tagged source archive predates this citation commit;
   the DOI will be visible on the repository's default branch, not retroactively
   inside the archived source.

The workflow uses GitHub's automatically provided token for GitHub access only;
requests to Zenodo are unauthenticated. The repository must permit Actions to
write to the default branch. If branch protection blocks the push, apply the
two-file citation change through the repository's normal review process rather
than weakening protection. A simultaneous branch update can also reject the
push; rerun the job against a fresh checkout. Published tags are never moved.

## Delays, errors and retries

If Zenodo takes longer, the sync fails visibly without changing the citation.
Check Zenodo → GitHub → eQc for an ingestion/metadata error. Once the record is
published, open GitHub → Actions → **Sync Zenodo citation** → **Run workflow**.
Leave the tag blank for the latest stable release, or enter its exact tag, such
as `v1.8.6`. This only reads Zenodo; it does not create a second archive or DOI.

Retries are idempotent. Older releases, prereleases, failed builds and a default
branch citation already advanced to another version are skipped. Multiple
matching archives or missing/unexpected DOIs cause a failure for inspection.
The job summary reports both DOIs after a successful sync.

This automation synchronizes citation metadata only. It does not upload the
Windows/macOS/Linux installers to Zenodo. GitHub remains their download source;
inspect the actual Zenodo record before claiming that it preserves binaries.

## Local verification

Run `node --test tests/zenodo-citation.cjs`. These checks use synthetic public
metadata and temporary files; they do not publish an archive or change project
citation files. The workflow runs these checks before querying Zenodo.

References: [Zenodo integration](https://help.zenodo.org/docs/github/enable-repository/),
[public records API](https://developers.zenodo.org/#records),
[DOI versioning](https://zenodo.org/help/versioning), and
[GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
