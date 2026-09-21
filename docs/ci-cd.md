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
| [Shared universe](../.github/workflows/universe.yml) | PRs always run classification and contract lint. Changed ownership selects application/test types, source/runtime/shell/renderer, preparation/publication and nebula checks. Main runs every lane. |
| [Object-scope gate](../.github/workflows/object-scope.yml) | Every PR: more than 12 changed object directories needs the `pipeline-change` label. Labels re-evaluate this gate. |
| [Nightly asset sweep](../.github/workflows/nightly.yml) | Scheduled/manual runs check all published keys and test types. A separately selected production build/browser check also runs on relevant PRs; it does not publish the site. Keep it outside the merge-required set unless it fits the total PR budget. |
| [Deploy](../.github/workflows/deploy.yml) | A successful Shared universe run on main automatically builds and deploys that exact revision. Manual dispatch also deploys. Merging is therefore not deployment-neutral. |

The universe and preparation status jobs aggregate their matrix lanes: every
selected lane must pass. Lint failures do not cancel unrelated checks or conceal
their results. A newer PR update cancels its stale run; main validation runs are
not cancelled by later merges. Production deployments use their own concurrency
group and can supersede an older deployment.

## Keep the PR path lean without dropping proof

- Put a check with the code it protects. Use the shared
  [affected-path map](../.github/ci-areas.json); unknown paths deliberately select
  all shared lanes. Do not add a second ownership map in workflow scripts.
- Keep correctness, source integrity, changed-key publication and relevant type
  checks blocking. Exhaustive remote sweeps and broad release qualification have
  scheduled/manual homes. Moving a check requires naming where its proof remains.
- Restore only inputs the selected tests consume. Compiler jobs need pinned JSON
  and generated shell data, not the global texture bank. Image-consuming tests
  must restore their real pinned inputs; missing data is not a pass.
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
- Narrowing a checkout does not buy latency here, and it is not free. HEAD's tracked
  source-media bank under `src/objects/*/source/` is 737 MB of the 1.14 GB working tree,
  so it looks like the obvious target. It is not: measured on run 35621432602, a non-cone
  `sparse-checkout` that dropped that media took the tree to 533 MB and moved checkout by
  nothing—22.4 s mean across the narrowed jobs against 25.8 s for the untouched jobs in
  the same run, inside the ordinary 20-36 s spread. `filter: blob:none` does not help
  either: Contract lint already sets it and checks out in the same time as jobs that set
  no options. Checkout on these runners is dominated by fixed per-job cost, not by bytes.
  Two hazards make it worse than neutral. Small non-JSON evidence under `source/` is read
  by more steps than it looks: `tools/prepare-facilities.mts --catalog-only` reads roughly
  350 such files and re-downloads or fails when one is absent, and the shell lane's
  `pnpm test:sbmt --unit` still reads Eros `.SUM` and `.INFO` observations because
  `SBMT_TEST_UNIT` narrows the case list without skipping those tests. Enumerating the
  wanted extensions is an allowlist over a data-driven citation set, so a new body citing
  a new extension fails later with a confusing network error. Separately,
  `tools/ci-cache-key.mts` digests the Git index, so paths
  left out of the worktree hash as `deleted`—a different cache identity from the
  unnarrowed jobs, and one that no longer reflects the real bytes. Spend effort on the
  steps that actually dominate a lane instead: building shared packages and restoring
  prepared assets, each 30-75 s against roughly 10 s of tests.

## Adding tests

Selection belongs in the existing test runner's configuration or
[package scripts](../package.json), using filename/folder globs. New matching test
files must run without editing a workflow list. Keep test cases at their current
paths; do not move them into a bespoke wrapper to make CI faster.

Node owns the native suites; Vitest owns package/renderer discovery. The nebula
application suite uses `node --import tsx --test` so TypeScript tests can resolve
their typed owners without generated caller files. Some older preparation suites
still use explicit selections; this is not a claim that every suite already has
automatic discovery. Existing setup-sensitive exceptions must remain covered.

When changing selection, prove both that a newly matching file is discovered and
that a deliberately failing assertion makes the command fail. When changing a
safety check, temporarily remove the protected behavior and confirm the regression
test goes red; restore it and confirm green. A comment alone proves nothing.

## Repairing asset and provenance failures

The [publishing instructions](../CONTRIBUTING.md#publishing-prepared-assets-maintainers)
own the commands and credentials. These rules prevent stale-receipt failures:

1. Verify the actual retained source bytes before changing any pin. Do not copy
   an expected hash merely to silence a failure.
2. If a source manifest changes, regenerate its dependent provenance using the
   canonical preparation owner and the complete required prepared bank. Review
   the resulting metadata; incomplete local inputs can produce a different receipt.
3. Refresh the tracked asset inventory, publish its new bytes, and verify the
   content-addressed key before merging. An inventory edit alone publishes nothing.
4. Keep local-byte validation at **every upload attempt**, including retry paths
   after a transient remote error. An initially live key does not permit uploading
   unverified local bytes later. Already-live assets need no local copy unless an
   upload becomes necessary.
5. Restore and run the affected source/package checks. A deploy is a consumer:
   it must reject tracked metadata drift, not silently rebake and repin assets.

PR publication checks normally inspect newly referenced keys. Changes to shared
inventory logic can conservatively expand that scope. Confirmed missing keys fail;
network uncertainty is reported as a warning, **not proof that publication passed**.
The scheduled sweep checks unchanged keys too. Diagnose the first failing step:
many red consumers may share one stale source or provenance receipt.

## Verifying a CI change

Use the [contributor checks](../CONTRIBUTING.md#check-your-change) to prepare a
clean checkout. `pnpm check:pr --list` prints the selected workflow commands;
`pnpm check:pr` runs that plan locally. `--job=<id>` and `--quick` are explicitly
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
- Remember that merging to main triggers deployment after main validation.
  For a validation-only task, leave the PR unmerged unless deployment is authorized.

Update this guide and the workflow budget comments in the same PR whenever the
selection, cache, publication or deployment contract changes.
