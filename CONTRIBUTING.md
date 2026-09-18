# Contributing to cssEarth

Thanks for helping. This page is the short route into the guides that already
exist; it does not repeat them.

## Set up

Use Node.js 24 (or 22.18+) and pnpm 10, then:

```sh
pnpm install
pnpm setup:assets
pnpm dev
```

`pnpm install` builds the shared packages, the renderer and the preparation
tools; `pnpm setup:assets` downloads the prepared browser images and each
object's baked `prepared/runtime.json` and `prepared/scene.json` (or, for
milky-way/heliosphere/stellar-neighbourhood/lmc and the nebulae, its whole
baked `prepared/` output) — git no longer tracks those files; `pnpm dev`
re-derives the prepared JSON transport beside each
body from what `setup:assets` just downloaded, and serves the site on port
4210. For a single body, use `pnpm setup:assets --object=<id>` and open
`/<id>/`. Run `pnpm setup:prepared [--object=<id>]` alone to restore only the
`prepared/*` inventory (skipping the public texture download) — useful when
only the JSON changed. For a production build, run `pnpm build`, then `pnpm
preview`; the build first runs `setup:assets` itself, which only downloads
files that are missing or changed.

Maintainer flow after baking a body or a context object: bake locally, `node
tools/publish-runtime-assets.mts --object=<id>` to publish every file its
`runtime-assets.json` and/or `prepared-assets.json` inventory (both kinds;
see [Publishing prepared assets](README.md#publishing-prepared-assets-maintainers)),
then commit the refreshed inventory — never the baked files themselves.

Development startup checks installed volume packages without preparing every
nebula. A missing or invalid package leaves its catalogue facts accessible and
marks its 3D view unavailable; other installed objects keep working. The selected
body and shared world resources still need their prepared assets. See the
[nebula guide](docs/nebulae/README.md#reproduce-from-a-clean-checkout) for restoration.
Restart the server after installing a package: its available banks stay fixed for
the session. Production builds require every configured volume package and
reject missing files, invalid metadata and mismatched asset hashes.

Re-preparing a body from its sources needs more: `pnpm prepare:checkout`
restores pinned source downloads, and some conversions call Python 3 with
`numpy`. You do not need any of that to work on the shell, renderer or docs.

## Check your change

`pnpm check:pr` runs the steps of the "Contract lint" CI job (lockfile, package
files and source citations, physical frame receipts and pins, published assets
your branch adds, documentation links) in about a minute and stops at the first
failure. `pnpm check:ci` runs the lint, typecheck and prepared-universe jobs'
command steps in order and takes far longer; `--job=<id>` picks one job and
`--list` shows the exact commands. Choose checks by what changed, and say in the
PR which ones you ran and which you did not.

To run the fast subset before every push, opt in with `pnpm hooks:install`: the
pre-push hook runs `pnpm check:pr --quick`, which skips the network check and the
documentation audits. Skip it once with `git push --no-verify` or
`CSSEARTH_SKIP_HOOKS=1`; remove it with `git config --unset core.hooksPath`.

Reference implementations live under `tools/oracles/` with their own pinned
Python environment (`pnpm oracles:setup`); their fixtures under `tests/oracles/`
are committed evidence, and the comparing tests run without Python. See
[tools/oracles/README.md](tools/oracles/README.md) before adding or regenerating
one. When an archive product has no reader, route or kernel bank yet, open an
issue from the archive-product template instead of writing a reader for one body.

GitHub Actions runs Contract lint, Typecheck, the prepared-universe tests, the
nebula and renderer tests, and the Object-scope gate on every PR and every push to
`main`. A nightly workflow checks that every inventoried asset is still published.

`node tools/check-object-runtime-ownership.mts --all` needs `prepare:object-json`'s prerequisites in place first
(it reads every body's prepared JSON); run `pnpm setup:assets` (which restores `prepared/runtime.json` and
`prepared/scene.json`, no longer committed) before it, or it fails on missing files rather than ownership defects.

Browser checks also require the exact prepared rendering assets. Sources and
catalogue preparation restore metadata, not those assets. Successfully opening
an unavailable Helix view does not qualify Helix's rendering or interaction.
Record the missing bank and any 404s, and restore the pinned assets before
claiming that object's interaction check. The installed-bank tamper test likewise
requires its referenced bank to be present.

## Where things live

| You want to | Read |
| --- | --- |
| Understand the rules every change must keep | [AGENTS.md](AGENTS.md) |
| Add or fix a planet, moon, asteroid or comet | [Body guide](src/objects/README.md) and the [celestial skill](.agents/skills/celestial-skill/SKILL.md) |
| Record sources, credits and evidence | [Provenance and documentation contract](docs/provenance/CONTRACT.md) |
| Find the shared guides | [docs/README.md](docs/README.md) |
| Write the PR | [PR template](.github/pull_request_template.md) and the [PR rules](docs/provenance/CONTRACT.md#pull-requests) |

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
