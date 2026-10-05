# CI/CD maintenance

PR feedback is part of the development experience: **target 2 minutes, maximum
3 minutes from a PR update until all merge-required checks finish**, including
queue, checkout, installation and final status jobs. This is the budget for the
whole required path, not each job. Job timeouts are emergency limits, not targets.
The budget is a review policy, not an automated timing gate; record actual GitHub
timings before claiming it is met. Report cold and warm-cache runs separately.

## What runs where

| Workflow | Trigger and responsibility |
| --- | --- |
| [Shared universe](../.github/workflows/universe.yml) | PRs run classification and contract lint; changed ownership selects application/test types, runtime/shell/renderer, preparation/publication and nebula checks. Main runs every shared lane. The path-filtered astroquery job installs pinned Python tools and requires every derived test file without skips. |
| [Repository audit](../.github/workflows/audit.yml) | Main pushes, scheduled runs and manual dispatch: documentation, repository completeness, source-catalogue reconciliation and bake reproduction. Advisory; does not run on PRs or gate deployment. |
| [Object-scope gate](../.github/workflows/object-scope.yml) | Every PR: more than 12 changed object directories needs the `pipeline-change` label. Labels re-evaluate this gate. |
| [Nightly asset sweep](../.github/workflows/nightly.yml) | Scheduled/manual runs check published keys, test types and a production build/browser probe. They do not publish the site or run on PRs. |
| [Deploy](../.github/workflows/deploy.yml) | Manual dispatch only. The default R2 deployment checks build asset references and requires verified published keys before shipping, then publishes to Cloudflare; the `host` input can publish to Netlify instead. Merging validates the gate; it does not deploy. |

The astroquery filter covers the owning workspaces of its discovered test files and their transitive runtime dependencies, toolchain pins and lane configuration. Its pip and toolchain caches are keyed on the pinned requirements and toolchain record. A skipped test or an incomplete derived file run fails the lane.

The universe and preparation status jobs aggregate their matrix lanes: every
selected lane must pass. Lint failures do not cancel unrelated checks or conceal
their results. A newer PR update cancels its stale run; main validation runs are
not cancelled by later merges. Production deployments use their own concurrency
group and can supersede an older deployment.

Source coverage combines Node tests, Chromium navigation/worker evidence and server
hits through one converter. The [coverage contract](coverage.md) defines the raw
format, targets, measured costs and exact job steps for integration. No separate
coverage workflow is introduced; the shared lane will run both the measured-floor
check and the base-ref check.

## Serving the site from Cloudflare

Production is on Netlify, which meters bandwidth. The same build can be served by Cloudflare, which does not meter
bandwidth or static file requests. The built pages become a Worker's static assets. [The Worker](../cloudflare/worker.ts)
answers the find and report endpoints and page addresses that carry a query, with the handlers the Netlify functions
call. The [Deploy workflow](../.github/workflows/deploy.yml) publishes it with the repository secrets
`CLOUDFLARE_API_TOKEN` (from the "Edit Cloudflare Workers" token template) and `CLOUDFLARE_ACCOUNT_ID`. From a checkout
with a wrangler login, these commands do the same:

```bash
ASSET_ORIGIN=https://earth-assets.lowpoly.cc pnpm build:deploy
pnpm deploy:cloudflare-preview   # https://cssearth-preview.cssearth.workers.dev
pnpm deploy:cloudflare           # css.earth
```

Each deploy command [bundles the Worker](../site/build/bundle-cloudflare-worker.mts), stages the search catalogues and
the `_headers` file into `dist`, answers one search and one page from the bundle, and uploads with wrangler. The preview
asks search engines not to index it. [The wrangler configuration](../wrangler.jsonc) names both targets; the site's own
address is the `production` environment, which attaches `css.earth` and `www.css.earth` to the Worker.

Tested on 2026-10-04 from Buenos Aires, against the Netlify site the same day:

| Request | Cloudflare preview | Netlify |
| --- | --- | --- |
| Static page, cached | 0.09 to 0.12 s | 0.18 to 0.36 s |
| Find, instance's first | 0.7 to 1.8 s | 3.1 s |
| Find, later | 0.11 to 0.15 s | 0.41 to 0.52 s (0.17 s from its CDN) |
| Page with a query, instance's first | 3.5 s | 6.0 s |
| Page with a query, later | 0.18 to 0.30 s | 1.1 to 1.7 s |

The Netlify site did not yet have this change's faster world load (6.1 s to 1.6 s under Node), which is part of its
6.0 s and of the preview's 3.5 s.

The whole site is 50,711 files, 9,874 of them HTML. Workers Free allows 20,000 static files in a Worker and stops the
page handler for its CPU time (error 1102), so the site needs Workers Paid, which allows 100,000 files.

How the Worker differs from the Netlify functions:

- An instance keeps the search catalogues and the world it loaded for later requests, and Cloudflare can stop a request in
  the middle of such a load. The Worker holds a load open when its reader disconnects. A search that has waited 10 s on
  another request's load reads the data itself ([kept load](../site/server/kept-load.mts)).
- A page address with a query gets the static page when its handler fails or has no answer in 10 s, and the Worker logs
  `page-handler-fallback` with the reason. The page's scripts read a view, dataset or feature from the address; a
  submitted search (`q`) and everything a reader without scripts would get are not rendered.
- Netlify keeps each find answer at its CDN until the next deploy. The Worker answers every find request itself; the
  browser still keeps an answer for five minutes.

## Keep the PR path lean without dropping proof

- Put a check with the code it protects. Use the shared
  [affected-path map](../.github/ci-areas.json); unknown paths deliberately select
  all shared lanes. Do not add a second ownership map in workflow scripts.
- Keep correctness, source integrity and relevant type checks blocking. Exhaustive
  remote sweeps and broad release qualification have scheduled/manual homes. Moving
  a check requires naming where its proof remains.
- PR jobs restore the prepared inputs their selected checks need, but do not run
  an exhaustive R2 publication sweep. Contributors publishing an object run
  `node packages/bake/cli/check-assets-published.mts --object=<id>` themselves. The
  default R2 deploy downloads and sha-verifies every inventoried key from R2 in
  its setup, with no restored cache, and runs `pnpm check:deploy-assets`; a key
  R2 does not serve blocks publication. The nightly sweep checks every key again. See the
  [publishing instructions](../CONTRIBUTING.md#publishing-prepared-assets-maintainers).
- Gate on what ships; report what is merely incomplete. A merge-required check may
  only assert something whose failure means the shipped application is broken, wrong
  or unverifiable as shipped: it does not compile, it does not build, it does not
  behave, or an asset it serves is missing. Repository completeness — a package file
  nobody has written yet, a source input that cannot be re-downloaded, a stale link,
  a misplaced file — is backlog. It stays visible and still turns a job red, but it
  may not veto an unrelated change.
- `Repository and provenance audit (advisory)` is where that backlog runs. It is
  deliberately absent from the repository's required status checks, so its result is
  reported without blocking a merge. This is not `continue-on-error`, a skip, a wider
  tolerance or a longer timeout: every selected check runs on each audit invocation, fails the
  job, and is named in the run summary. Do not move a check there to silence it —
  move it only when its failure cannot make the deployed site broken or wrong, and
  say in the pull request where the shipped-side proof remains.
  Runtime inventories own the published bytes' R2 content addresses. Source
  manifests describe paths, acquisition and attribution; do not reintroduce
  their retired file-stability pins as a merge gate.
- Source-catalogue reconciliation and broad bake reproduction run in the separate
  Repository audit workflow. They can expose missing sources or stale recipes
  without changing a PR's required verdict. Inspect that workflow's result
  separately; a green Shared universe run does not mean the audit passed.
- Restore only inputs the selected tests consume. Compiler jobs need declared JSON
  and generated shell data, not the global texture bank. Image-consuming tests
  must restore their real inputs; a source-dependent skip is not qualification.
- Parallelize independent owners. Keep a writer ahead of readers of its outputs
  in the same workspace; local execution is serial where GitHub has isolated disks.
- Cache dependency installation, compiled artifacts and compiler state—not test
  verdicts. Keep running the tests on a cache hit. Compiled outputs require exact
  input keys, which name each input by its Git object id; restored assets still
  require the inventory's byte-count and content-address validation.
- Use separate cache identities for declaration-producing and JavaScript-only
  builds, and for concurrent compiler programs. A JavaScript build may clean
  declarations needed by a later typecheck.
- Do not hide a failing check with `continue-on-error`, a wider tolerance, skipped
  cases or a larger timeout. Fix the owning defect and retain a regression test.
- The heavy universe jobs use a partial clone and the shared `code-and-text`
  sparse-checkout pattern. Nebula extends that tree with the complete volume
  packages identified by their source manifests, retaining tracked previews and
  compact inputs without unrelated planetary binaries. Validate any pattern change
  against the actual selected consumers, including their source/label dependencies
  and cache keys.

An earlier checkout experiment, recorded in [PR #475](https://github.com/layoutit/css.earth/pull/475)
and run [35621432602](https://github.com/layoutit/css.earth/actions/runs/35621432602),
measured 22.4 s mean for narrowed jobs versus 25.8 s for untouched jobs, inside
that run's normal spread. [PR #549](https://github.com/layoutit/css.earth/pull/549)
later introduced the current pattern and documented its checked consumers and
original nebula exception. Neither an older timing nor the smaller checkout alone proves
that today's required feedback meets the budget; measure the current workflow.

## Adding tests

Selection belongs in the existing test runner's configuration or
[package scripts](../package.json), using filename/folder globs. New matching test
files must run without editing a workflow list. Keep test cases at their current
paths; do not move them into a bespoke wrapper to make CI faster.

`node --test` runs every suite. `pnpm test:run` loads
`packages/core/src/node/register-vite-suffix.mts` for Vite imports and enables module mocks; `test:packages`
runs `packages/` and `integration/`; `test:site` runs `site/`, `src/` and `.github/`. The lab CLI owns lab-test discovery; `pnpm test:lab` also runs its
assets stage first. Distinguish source-dependent skips from executed checks.

When changing selection, prove both that a newly matching file is discovered and
that a deliberately failing assertion makes the command fail. When changing a
safety check, temporarily remove the protected behavior and confirm the regression
test goes red; restore it and confirm green. A comment alone proves nothing.

## Repairing asset and provenance failures

The [publishing instructions](../CONTRIBUTING.md#publishing-prepared-assets-maintainers)
own the commands and credentials. These rules prevent stale-receipt failures:

1. Verify actual bytes against their owning inventory before changing that
   record. Only `inventory.json` holds a hash, the R2 content address; source
   manifests, receipts and locks name files by path. Never edit an inventory
   entry merely to silence a failure.
2. If a source manifest changes, regenerate its dependent provenance using the
   canonical preparation owner and the required prepared bank. Layered bodies
   regenerate lineage; volumes and catalogues publish baked provenance. Review
   the result and record missing source inputs without claiming a fresh bake.
3. Refresh the tracked asset inventory, publish its new bytes, and verify the
   content-addressed key before merging. An inventory edit alone publishes nothing.
4. Keep local-byte validation at **every upload attempt**, including retry paths
   after a transient remote error. An initially live key does not permit uploading
   unverified local bytes later. Already-live assets need no local copy unless an
   upload becomes necessary.
5. Restore and run the affected source/package checks. A deploy is a consumer:
   it must reject tracked metadata drift, not silently rebake and repin assets.

The publication checker supports selecting objects or keys added since a Git
reference for a local investigation. Its default verdict treats confirmed 404s
as failures and network uncertainty as warnings, not proof of availability.
The default R2 deploy uses `--require-verified` to reject either. No automatic PR
publication sweep runs; the scheduled sweep includes unchanged keys. Diagnose
the first failing owner when many consumers report the same missing input.

## Verifying a CI change

Use the [contributor checks](../CONTRIBUTING.md#check-your-change) to prepare a
clean checkout. `pnpm check:pr --list` prints the selected workflow commands;
`pnpm check:pr` runs that plan locally. The local runner can include advisory and
production-smoke jobs even though their GitHub triggers exclude PRs.
`--job=<id>` and `--quick` are explicitly
partial checks, never a complete PR verdict. Local duration is not GitHub latency.

Preparation tests can write generated metadata in the local checkout. GitHub's
production probe has a separate checkout; locally, inspect those changes before
the production check and use the intended committed inventories. Do not commit
or publish incidental test outputs to make the production check pass. Preserve
pre-existing work when cleaning up changes made by your own test run.

Before merging a CI change:

- Fetch both the PR branch and main; preserve collaborators' commits and resolve
  integration conflicts. Check the final PR diff, not only the last local commit.
- Run targeted regressions during repair; at the final boundary, run all selected
  checks and the production build/browser probe when the plan selects it.
- Confirm the **latest remote head** is green. Record the run link, tested SHA,
  total required-check latency, slowest lane, and cold/warm cache state in the PR.
  A cancelled run, started process or green older commit is not completion.
- Compare representative changes: docs-only, object data, shared runtime and CI
  configuration. A fast docs-only run does not establish the shared-code budget.
- If required feedback exceeds 3 minutes, identify checkout/install, repeated
  preparation, asset transfer, compiler work and queue time separately. Optimize
  the measured critical path; do not silently raise the budget or remove proof.
- Verify repository-required status names still match the workflows after any
  rename. Adding a required check needs an explicit budget review.
- Merging triggers main validation. Deploying is a separate manual dispatch;
  record the intended revision when requesting a deployment.

Update this guide and the workflow budget comments in the same PR whenever the
selection, cache, publication or deployment contract changes.

### Derived toolchain and foreign-test coverage

The astroquery lane discovers tests importing `astroqueryToolchain`, prints its
file list, runs each file and requires a passing TAP summary with zero skips.
Triggers come from each lane file's owning package and its transitive runtime
workspace dependencies, including telescope-cli, bake, renderer, astronomy, engine
and spice, plus the discovered tests and lane configuration.
The mixed bake HEALPix suite is excluded by name: it also reads the untracked
Luhman 16 B posterior mean and variance NPY maps. It remains in bake's
source-qualified test lane, where absent maps deliberately skip through
`MissingSourceInputError`. The toolchain-only lane does not restore those maps.

Discovery currently finds 394 bake/telescope-cli tests importing objects. The
foreign-test limit is 150 files, so objects-only changes retain the tool gate;
when the derived count falls to 150 or fewer, those imports select each test.
Fixture readers and source-code pins are discovered from test literals, with
module-relative and checkout-relative paths, rather than maintained owner maps.

The mixed CLI `output-handoffs.test.mts` suite is excluded by name because its PDS
case needs the PDS toolchain and its stellar inspection needs restored
stellar-neighbourhood `prepared/stars.json` and `stars.bin`. It remains in the
source-qualified CLI lane. The other 13 toolchain files use generated temporary
fixtures or tracked fixtures; the astroquery lane requires zero skipped tests.

Classification's sparse checkout includes every expanded root `test:packages`
and `test:site` test glob. A real sparse-clone regression compares objects-only
foreign selection against the full checkout without restoring prepared assets.

Source and CLI export allowances carry committed ceilings and per-entry reasons.
Checks need no git history, fail on missing budgets and reject counts above the
ceiling. Tests pin each ceiling to the current entry/export count. Lowering the
budget means removing allowances and editing the ceiling; raising a ceiling is
an explicit reviewed change in the same diff as its justified additions.
