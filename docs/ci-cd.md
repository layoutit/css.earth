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
| [Shared universe](../.github/workflows/universe.yml) | PRs run classification and contract lint; changed ownership selects application/test types, runtime/shell/renderer, preparation/publication and nebula checks. Main runs every lane. |
| [Repository audit](../.github/workflows/audit.yml) | Main pushes, scheduled runs and manual dispatch: documentation, repository completeness, source-catalogue reconciliation and bake reproduction. Advisory; does not run on PRs or gate deployment. |
| [Object-scope gate](../.github/workflows/object-scope.yml) | Every PR: more than 12 changed object directories needs the `pipeline-change` label. Labels re-evaluate this gate. |
| [Nightly asset sweep](../.github/workflows/nightly.yml) | Scheduled/manual runs check published keys, test types and a production build/browser probe. They do not publish the site or run on PRs. |
| [Deploy](../.github/workflows/deploy.yml) | Manual dispatch only. The default R2 deployment checks build asset references and requires verified published keys before shipping. Merging validates the gate; it does not deploy. |

The universe and preparation status jobs aggregate their matrix lanes: every
selected lane must pass. Lint failures do not cancel unrelated checks or conceal
their results. A newer PR update cancels its stale run; main validation runs are
not cancelled by later merges. Production deployments use their own concurrency
group and can supersede an older deployment.

## Keep the PR path lean without dropping proof

- Put a check with the code it protects. Use the shared
  [affected-path map](../.github/ci-areas.json); unknown paths deliberately select
  all shared lanes. Do not add a second ownership map in workflow scripts.
- Keep correctness, source integrity and relevant type checks blocking. Exhaustive
  remote sweeps and broad release qualification have scheduled/manual homes. Moving
  a check requires naming where its proof remains.
- PR jobs restore the prepared inputs their selected checks need, but do not run
  an exhaustive R2 publication sweep. Contributors publishing an object run
  `node tools/assets/check-assets-published.mts --object=<id>` themselves. The
  default R2 deploy additionally runs `pnpm check:deploy-assets` and
  `pnpm check:assets-published --require-verified`; missing or unverified keys
  block publication. The nightly sweep checks every key again. See the
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
  Runtime inventories own the published bytes' SHA-256 identities. Source
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
  input keys; restored assets still require byte-count and SHA-256 validation.
- Use separate cache identities for declaration-producing and JavaScript-only
  builds, and for concurrent compiler programs. A JavaScript build may clean
  declarations needed by a later typecheck.
- Do not hide a failing check with `continue-on-error`, a wider tolerance, skipped
  cases or a larger timeout. Fix the owning defect and retain a regression test.
- The heavy universe jobs use a partial clone and the shared `code-and-text`
  sparse-checkout pattern. Nebula keeps a full tree because its restoration reads
  tracked preview images. Validate any pattern change against the actual selected
  consumers, including their source/label dependencies and cache keys.

An earlier checkout experiment, recorded in [PR #475](https://github.com/layoutit/css.earth/pull/475)
and run [35621432602](https://github.com/layoutit/css.earth/actions/runs/35621432602),
measured 22.4 s mean for narrowed jobs versus 25.8 s for untouched jobs, inside
that run's normal spread. [PR #549](https://github.com/layoutit/css.earth/pull/549)
later introduced the current pattern and documented its checked consumers and
nebula exception. Neither an older timing nor the smaller checkout alone proves
that today's required feedback meets the budget; measure the current workflow.

## Adding tests

Selection belongs in the existing test runner's configuration or
[package scripts](../package.json), using filename/folder globs. New matching test
files must run without editing a workflow list. Keep test cases at their current
paths; do not move them into a bespoke wrapper to make CI faster.

Node owns the native suites; Vitest owns package/renderer discovery. `test:node`
loads `tests/register-vite-suffix.mts` for the site's Vite imports. The lab CLI
owns lab-test discovery; `pnpm test:lab` also runs its assets stage first.
Some preparation suites keep explicit selections. Preserve setup-sensitive
exceptions and distinguish source-dependent skips from executed checks.

When changing selection, prove both that a newly matching file is discovered and
that a deliberately failing assertion makes the command fail. When changing a
safety check, temporarily remove the protected behavior and confirm the regression
test goes red; restore it and confirm green. A comment alone proves nothing.

## Repairing asset and provenance failures

The [publishing instructions](../CONTRIBUTING.md#publishing-prepared-assets-maintainers)
own the commands and credentials. These rules prevent stale-receipt failures:

1. Verify actual bytes against their owning inventory, delivery receipt or
   toolchain lock before changing that record. Source manifests do not contain
   digest expectations. Never copy an expected hash merely to silence a failure.
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
