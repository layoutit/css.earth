# Contributing to cssEarth

Thanks for helping. This page is the short route into the guides that already
exist; it does not repeat them.

## Set up

Use Node.js 24 (or 22.18+) and pnpm 10, then:

```sh
pnpm install
pnpm dev
```

`pnpm install` builds the shared packages, the renderer and the preparation
tools. `pnpm dev` restores every object's baked `prepared/` output and the
prepared browser images from R2 (nothing under `prepared/` is tracked; only
files that are missing or changed are downloaded), derives the prepared JSON
transport beside each body, and serves the site on port 4210. A warm start
takes about 17 s; `pnpm setup:assets` runs the restore on its own. For a
single body, use `pnpm setup:assets --object=<id>` and open `/<id>/`. Run `pnpm setup:prepared [--object=<id>]` alone to restore only the
`prepared/*` entries (skipping the public texture download) — useful when
only the JSON changed. Either restore also derives the files R2 never holds
(`prepared/object.json`, `page.json` and a layered body's `provenance.json`)
for restored bodies that lack them. For a production build, run `pnpm build`, then `pnpm
preview`; the build first runs `setup:assets` itself, which only downloads
files that are missing or changed.

Maintainer flow after baking a body or a context object: bake locally, `node
tools/assets/publish-runtime-assets.mts --object=<id>` to publish every file its
`inventory.json` lists (public textures and baked `prepared/*` files alike;
see [Publishing prepared assets](#publishing-prepared-assets-maintainers)),
then commit the refreshed inventory — never the baked files themselves. A change across many bodies adds
`--since=origin/main`: it checks and uploads only the inventory entries that main does not already list.

Development startup checks installed volume packages without preparing every
nebula. A missing or invalid package leaves its catalogue facts accessible and
marks its 3D view unavailable; other installed objects keep working. The selected
body and shared world resources still need their prepared assets. See the
[nebula guide](docs/nebulae/README.md#reproduce-from-a-clean-checkout) for restoration.
Restart the server after installing a package: its available banks stay fixed for
the session. Production builds require every configured volume package and
reject missing files, invalid metadata and mismatched asset hashes.

Re-preparing a body from its sources needs more: run
`node tools/assets/restore-source-inputs.mts --object=<id>` to restore missing
source files, then `pnpm prepare:objects --object=<id>` for the bake. Downloads
are addressed by their source paths and origin URLs; manifests do not verify
source digests. Some conversions need the documented Python/native toolchains.
Source acquisition and baking are separate from working on the shell, renderer or docs.

## Checklist: a change that bakes or rebakes assets

Does your change add a body, rebake one, or alter anything under a `prepared/`
directory? Then the baked bytes must reach R2 **before the pull request can
merge**, and the tracked inventory must be part of the diff. Git holds the
inventory; R2 holds the bytes.

1. Bake the object. `pnpm prepare:objects --object=<id>` for a body,
   `pnpm prepare:volume src/objects/<id>` for a volume field. From a clean
   checkout, restore that object's sources with
   `node tools/assets/restore-source-inputs.mts --object=<id>` first.
2. Publish the bytes: `node tools/assets/publish-runtime-assets.mts --object=<id>`.
   Safe to repeat — keys are content-addressed, so it uploads only what is
   missing.
3. Commit the refreshed `inventory.json`.
   **Never commit the baked files themselves**; they are gitignored.
4. Confirm before pushing: `node tools/assets/check-assets-published.mts --object=<id>`.
   **Run this yourself.** PRs do not run a publication sweep. The default R2
   deployment separately requires every inventoried key to be verified before
   publishing; the nightly sweep checks them again.

Skipping publication can leave a PR green but block the later deployment.
The default deploy serves textures from R2 without a `public/scenes` copy,
downloads and sha-verifies every inventoried key from R2 while it builds, and
checks build references with `pnpm check:deploy-assets`. A key R2 does not
serve stops that deployment. Merging does not deploy: production requires manual
dispatch of `.github/workflows/deploy.yml`.

### If you do not have R2 credentials

Publishing needs write access to the bucket, which outside contributors do not
have. Baking does not — run steps 1 and 3 yourself and commit the inventory,
then say in the pull request that the bytes still need publishing.

A maintainer then runs the **Publish prepared assets** workflow against your
pull request (Actions → Publish prepared assets → Run workflow, with the pull
request number, the object id and its kind, using the main branch). It rebakes
your branch and checks the inventory. Before uploading, trusted tooling compares
the inventories with the frozen pull request commit and verifies every file hash.
Nothing needs to be pushed to your branch, and no maintainer has to reproduce
your setup locally.

Fork pull requests may need maintainer approval before GitHub runs their CI.
That approval does not publish assets; use the separate workflow above.

## Publishing prepared assets (maintainers)

Prepared runtime files are served from an R2 bucket, content-addressed as `runtime-assets/<sha256>/<filename>`. One small inventory per object is tracked in Git instead of the baked bytes: `inventory.json`, listing the public browser textures and everything baked under `prepared/`, each entry with its location, filename, bytes and hash (`object.json` and `page.json` are regenerated, not inventoried; layered-body provenance is regenerated too, while volumes, image layers and catalogues publish their baked `provenance.json`). The inventory owner also excludes audit-only terrain reports and source-index rasters.

A page embeds only the hashes its first view reads: files its prepared markup and styles name, its startup resources and the textures its server markup writes. Each other resource's hash waits in a same-origin group file, `/objects/<id>/asset-hashes/<group>.json`, which the browser reads the first time a zoom level or dataset needs it. Resources whose keys differ only in their first index share a group (one dataset's pages at one level); keys without an index share one. A hash is 64 characters that do not compress, so Earth's page would otherwise carry 1,754 of them ([`site/asset-origin.mts`](site/asset-origin.mts)).

After baking, publish and commit the refreshed inventory:

```sh
node tools/assets/publish-runtime-assets.mts --object=<id>
```

Omit `--object` to publish everything under `src/objects/`. The publisher is incremental: it checks every key first, uploads only the missing ones, then checks every key again, retries anything the bulk upload dropped, and byte-verifies every JSON key plus a sample of the rest. A publish that reports success has confirmed the files are live. JSON keys upload as `application/json`; everything else as `application/octet-stream`.

`node tools/assets/check-assets-published.mts [--object=<id> ...]` checks the selected inventories without uploading. It retries a miss before reporting it: longest (about two minutes, two at a time) for a network error, which it reports by its socket code. With `--added-since=<git ref>` it checks only the keys the branch's inventories add; `--added-since-last-green` compares with the last green `main` run. By default only a real 404 fails it; other answers and unverified (network) keys are warnings. `--require-verified`, used by the default R2 deploy, fails on any unverified key; `--report-only` is observational. A nightly workflow checks every key; pull requests check none.

A second cache, `source-cache/<object id>/<manifest path>`, mirrors downloaded
inputs by the same path their source manifest names. Restorers try it before the
origin URL when a file is missing. `node tools/assets/publish-source-cache.mts
--object=<id>` publishes that object's available downloads; restore them first
with `node tools/assets/restore-source-inputs.mts --object=<id>`. To publish one
file, use `--file=<path> --key=<object id>/<manifest path>`. The publisher verifies
the upload; this is not a manifest digest check during acquisition. Earlier
hash-addressed source-cache keys may remain in R2, but current restorers use the
path keys and fall back to the source archive.

Both scripts need an authenticated `wrangler`. Neither ever deletes a key.

`node tools/assets/prune-runtime-assets.mts --dry-run` reports, and never deletes, the `runtime-assets/<sha256>/...` keys that are live in R2 but referenced by no current inventory. It never lists or reports on `scenes/` or `source-cache/`. It needs a separate read-only R2 API token, because `wrangler` cannot list a bucket's objects; the comment at the top of that file explains how to get and set one.

## Check your change

The [CI/CD maintenance guide](docs/ci-cd.md) sets the shared **2-minute target,
3-minute maximum** for required PR feedback and the rules for changing the pipeline.

`pnpm check:pr` and `pnpm check:ci` read the workflow commands and the shared
changed-path map. The local plan can also include the advisory audit and
production smoke check, whose GitHub workflows run on main or schedule/dispatch
rather than on pull requests. Use `--list` to see the actual local selection.
The default base is `origin/main`; `--base=<ref>` changes it. Local selection
also includes staged, unstaged and untracked files. `--list` prints the selected
jobs and exact workflow commands without running them; `--job=<id>` selects one
lane; `--all` runs every lane. Local jobs run serially and stop on failure;
GitHub runs independent jobs in parallel. More than 12 changed object packages
requires `--pipeline-change` locally and the matching label on the PR.

Unknown ownership selects all shared lanes. Changed object data selects package
integrity tests; documentation-only changes keep lint. The documentation checker
can compare a change with its base and reject new findings or findings in changed
files, including broken inbound links. GitHub runs the full documentation audit
in the separate advisory Repository audit on main, scheduled runs and dispatch;
it is not a merge-required PR check. The compiler lanes restore their actual pinned
JSON inputs and generate real shell data, without downloading body texture banks.
Full-universe integrity and production-build checks remain distinct and can
still expose unrelated package defects. Report those failures; do not bypass pins.

Test selection belongs in the native `package.json` scripts, not workflow file
inventories or a separate runner. `test:node` and the `test:universe:*`
suites use quoted Node filename/folder globs; Vitest retains its
package and renderer discovery. Matching new tests run automatically without a
workflow edit. Existing filenames with different setup requirements remain explicit
exceptions; do not broaden a glob to include asset-authoring tests in a read-only
runtime suite. Tests stay beside their current owners.

The required universe matrix separates runtime, shell and renderer checks;
every selected lane must pass. The preparation gate checks publication. Source
catalogue reconciliation and broad bake reproduction run in the separate advisory
audit. Native tests needing unavailable sources, prepared outputs or toolchains
can skip through `tests/objects/source-test.mts`; a pass with skips does not prove
those inputs or rendering paths. Run focused tests with the needed inputs installed.
Compiled artifacts use exact-input caches; these never cache a test verdict.
Package and renderer caches follow compiler inputs; preparation retains a
conservative whole-tree key. The preparation bundle ships JS only: type checks
read its sources through the root `#preparation/*` imports. Cached
baked JSON remains subject to the installer's byte and SHA-256 checks on every run.
Cold and cached CI timings must be reported separately.

To run the fast subset before every push, opt in with `git config core.hooksPath .githooks`: the
pre-push hook runs `pnpm check:pr --quick`, which runs the `Contract lint` merge
gate and the advisory repository audit, skipping the network check and the
documentation audits. Skip it once with `git push --no-verify` or
`CSSEARTH_SKIP_HOOKS=1`; remove it with `git config --unset core.hooksPath`.

Reference implementations live under `tools/oracles/` with their own pinned
Python environment (`node tools/oracles/setup.mts`); their fixtures under `tests/oracles/`
are committed evidence, and the comparing tests run without Python. See
[tools/oracles/README.md](tools/oracles/README.md) before adding or regenerating
one. When an archive product has no reader, route or kernel bank yet, open an
issue from the archive-product template instead of writing a reader for one body.

GitHub Actions always runs Contract lint and the Object-scope gate. It also
always runs Typecheck, the prepared-universe tests, the prepared-universe
preparation and galaxy field job, and the nebula and renderer tests on every push
to `main`; on a pull request it runs only the ones `.github/ci-areas.json` maps
your changed paths to (`tools/ci/ci-affected.mts`, computed by the "Classify
changes" job) — a job it skips still reports success, never failure, so it never
blocks merging. When in doubt about what a change affects, it runs everything. A
nightly workflow checks that every inventoried asset is still published.

`node tools/ci/check-object-runtime-ownership.mts --all` needs `prepare:object-json`'s prerequisites in place first
(it reads every body's prepared JSON); run `pnpm setup:assets` (which restores `prepared/runtime.json` and
`prepared/scene.json`, no longer committed) before it, or it fails on missing files rather than ownership defects.

Browser checks also require the exact prepared rendering assets. Sources and
catalogue preparation restore metadata, not those assets. Successfully opening
an unavailable Helix view does not qualify Helix's rendering or interaction.
Record the missing bank and any 404s, and restore the pinned assets before
claiming that object's interaction check. The installed-bank tamper test likewise
requires its referenced bank to be present.

Telescope family/import integration tests require the pinned astronomy toolchain
described in [Astronomy package ownership](docs/astronomy-package-ownership.md).
Without it, content qualification and Python-backed operations fail; that is an
environment limitation, not a passing integration result.

## Where things live

| You want to | Read |
| --- | --- |
| Understand the rules every change must keep | [AGENTS.md](AGENTS.md) |
| Add or fix a planet, moon, asteroid or comet | [Body guide](src/objects/README.md) and the [celestial skill](.agents/skills/celestial-skill/SKILL.md) |
| Record sources, credits and evidence | [Provenance and documentation contract](docs/provenance/CONTRACT.md) |
| Find the shared guides | [docs/README.md](docs/README.md) |
| Write the PR | [PR template](.github/pull_request_template.md) and the [PR rules](docs/provenance/CONTRACT.md#pull-requests) |

## Commits

Write every commit as one [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) line, for example
`refactor(core): move sha256 into core`. Leave out a body, trailers and any attribution such as `Co-Authored-By`.
Split a change into small steps so each line explains one step. Git's own merge, revert and `--fixup` messages are
accepted as Git writes them.

`pnpm install` installs a `commit-msg` hook that checks each message as you commit (it leaves an existing hook of your
own in place). CI runs the same check over every commit in a pull request as part of the required `Classify changes`
job, so reword a rejected commit with `git rebase -i` rather than skipping the hook.

## Pull requests

- Title with [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `fix(shell): ...`, `feat(universe): ...`, `docs: ...`.
- Lead with the problem and what now happens. Link the body README or guide you changed.
- Keep prepared outputs reproducible from checked-in inputs, and keep evidence beside the body it belongs to. Do not commit scratch output.
- Every added file must support a named claim, explanation or test. Explain unusually large additions.
- A PR touching more than 12 `src/objects/<id>/` directories fails the separate "Object-scope gate" check unless it
  carries the `pipeline-change` label; that check re-runs on its own when the label is added or removed, so labeling
  an already-red PR clears it without pushing a new commit. Keep ordinary body work scoped to a few bodies instead
  of asking for the label.

## Licence

Code is MIT ([LICENSE](LICENSE)). Scientific sources keep their own licences
and credits, recorded in each body's `NOTICE.md` and `source/manifest.json`.
