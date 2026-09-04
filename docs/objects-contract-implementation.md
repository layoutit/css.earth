# Objects contract: implementation and review evidence

Delivery: one PR on `feat/pluto-object-contract`, based on
`ba1efaf32da7d02bdf041006455e7735e9c0d074`. No merge or deployment is included.

## Scope

- Pluto is a source-backed standalone dwarf planet with color, topography, and
  monochrome lenses. A prepared gray grid marks identified coverage gaps.
  Projective texture warps are baked offline to avoid triangular child-texture
  flattening artifacts. The runtime retains 931 stage nodes.
- One open-ended `OBJECTS` registry and one generic adapter serve all eleven
  objects. Search includes every object; the scale filters `planet` classification.
- Every object owns its marker recipe and presentation. Generic package checks
  enforce byte/source closure; NASA editorial validation remains provider-owned.
- Every mount selects one canonical highest-density asset bank, independently
  of display scaling. No runtime renderer, shared camera/input policy, lifecycle,
  router, or adapter changes; no new production dependencies or capability flags.

Pluto's scientific limits, authored choices, licenses, and conservative JPEG
coverage mask are documented in `src/planets/pluto/SOURCE.md` and `FIT.md`.
The five scoped upstream whitespace exemptions preserve verbatim source bytes.

## moltronB review resolutions

The attached review covered head `c63229a3`. These repairs follow it in the same PR.

| Finding | Resolution and check |
| --- | --- |
| F1: marker preservation claim | Withdrawn. Growing the Q75 atlas from 9 to 11 tiles changes decoded pixels in every legacy tile. Recipes and presentation dimensions are preserved, not shipped pixels. This is an intentional reviewed shell diff. Tests now pin the current atlas hashes directly; the old unused hashes and self-reference are gone. |
| F2: stable clipping | Stability alone proves nothing about completeness. The audit now independently requires visible pixels in fixed body and ring regions, including the previously missing upper ring. Tests reject a persistent clip in each region at every supported viewport/display scale, even when both input images are identical. |
| F3: staging can ship | Staging and recoverable backups live in `node_modules/.cache/`, outside Vite's `public/` tree. Cross-device moves use exclusive copy plus unlink. Tests inject source, publication, rollback, and cross-device failures; failed rollback retains recoverable bytes outside public. |
| F4: copied sky notices | Pluto's ESO/HYG notices now name Pluto and explicitly identify the shared Earth/Moon HYG registration subset. Document sizes/hashes are updated; scientific source bytes are unchanged. |
| F5: local evidence | Results below are author-local observations, not independently accessible PR artifacts or hosted CI results. Machine-neutral reproduction commands are provided. Audit scripts record browser, capture time, source fingerprints, and actual loaded asset hashes, and refuse to overwrite evidence. |
| F6: dead marker props/order | Removed unused `index`/`count` props and call arguments. A test binds every prepared atlas index to the corresponding search index, including the Earth/Moon distance tie. |
| F7: classification typos | A schema vocabulary validates star, planet, satellite, dwarf-planet, asteroid, and comet. Unknown/misspelled classes fail. New identities remain open-ended; new classes require an explicit schema extension. |
| F8: Neptune origin | Neptune's marker uses the exact HTTP(S) source URL already pinned in its manifest. Object-owned marker recipes require valid HTTP(S) origins; authored utility controls retain honest local provenance. |
| F9: Sun's distance label | Search displays “Our star” for the zero-distance star. Browser checks verify that label and all other AU labels on desktop and mobile. |

The earlier review's complete ring-override validation and offline navigation
publication rollback remain covered. Publication is not a crash-atomic live
release system; a failed rollback reports where recovery copies remain.

### Venus decision

Keep the existing bounded shared fly-to behavior: Venus's default zoom 1.9
times factor 2.33 clamps to maximum 4. The clamp is intended for this PR; neither
the shared factor nor Venus's framing is retuned. An inward wheel at that limit
cannot rebase its target, so the rebase test wheels outward and still requires
exactly one rebase. Other inward-wheel assertions remain. The short material
gesture is 30 px, not 150 px; its one-frame limit and wide-orbit checks remain.
Both original test-input failures were reproduced on the untouched base.

## What the visual gate proves

The original clipped Saturn baseline was caught by comparison with a fresh
capture, **not** by the three-frame stability window. Its 254,492 changed pixels
outside marker regions invalidated that old comparison. Those files remain local
for diagnosis and are not acceptance evidence.

The independent coverage sentinels in `tools/saturn-scene-coverage.mjs` were
selected from visually inspected, source-bound base captures, not from the
candidate. They cover the body and separate ring arcs at widths 390/820/1440.
Most base regions had at least 95.59% lit pixels; the north-west region had
67.8%. Floors of 90%/60% catch missing regions while allowing edge noise. The
historical clipped upper ring measures 0% and fails the new check directly.
These are missing-region sentinels, not proof that every scene pixel is correct.

The audit also requires three identical frames within 24 attempts, a matching
shell hide/restore round-trip, and an unmasked scene comparison with zero changed
pixels. Full-shell differences may occur only within measured marker images and
one physical pixel of their antialias edges. Text, panels, and broad scene areas
are not excluded. Raw absolute diffs retain all marker changes.

This is browser regression evidence, not native-renderer or source-map/globe
pixel parity. Short rAF/CDP samples do not prove compositor smoothness, power
equivalence, native timing, or a performance improvement.

## Reproduce on another machine

Use Node/pnpm from `package.json` and installed Google Chrome. The following
commands run from the candidate checkout. They download large pinned sources;
do not run preparations concurrently against the same checkout.

```sh
pnpm install --frozen-lockfile
pnpm prepare:checkout
pnpm acquire:planets -- --verify-only
pnpm test
pnpm build
pnpm exec astro dev --host 127.0.0.1 --port 4211
```

In another terminal in that checkout:

```sh
pnpm test:browser http://127.0.0.1:4211
node src/planets/pluto/tools/audit.mjs http://127.0.0.1:4211 output/playwright/pluto-review-fresh
git diff --check
```

The Pluto audit captures each lens at the coverage boundary, rotated pole view,
and zoomed view under both display scales. It checks affine prepared frames,
retained identity, and loaded image bytes against the runtime manifest. The flat
source references are separate: no misleading flat-map/globe pixel diff is made.

For the Saturn comparison, prepare an independent base worktree. Keep its
checked Saturn runtime/manifest files unchanged after preparation; if those
bytes drift, diagnose the preparation environment before accepting a comparison.

```sh
candidate_root="$(pwd)"
baseline_root="${candidate_root}-contract-baseline"
git worktree add --detach "$baseline_root" ba1efaf32da7d02bdf041006455e7735e9c0d074
(
  cd "$baseline_root"
  pnpm install --frozen-lockfile
  node tools/restore-source-inputs.mjs
  node src/planets/saturn/tools/prepare.mjs
  git diff --exit-code -- src/planets/saturn
  pnpm exec astro dev --host 127.0.0.1 --port 4212
)
```

With both servers running, use the **candidate's audit tool** for both builds:

```sh
candidate_root="$(pwd)"
baseline_root="${candidate_root}-contract-baseline"
evidence_root="$candidate_root/output/playwright/contract-review-fresh"
node tools/audit-object-contract.mjs baseline http://127.0.0.1:4212 "$baseline_root" "$evidence_root"
node tools/audit-object-contract.mjs candidate http://127.0.0.1:4211 "$candidate_root" "$evidence_root"
```

Use a new evidence directory each run and verify that each URL serves the named
checkout. Different loopback ports are allowed; browser version, source/runtime
fingerprints, loaded bytes, asset selection, geometry, and comparison protocol
must match. Stop only the servers you started when finished.

## Author-local validation record

Screenshots, reports, logs, raw binaries, and prepared image banks are ignored
and are **not available from the PR tree**. Their numerical results are local
author claims; reviewers must rerun the commands above for independent evidence.
The checked-in tests, tools, source URLs, hashes, and coverage probes are the
reproducible part of the submission.

The review-repair run on 2026-09-04 is recorded under
`output/playwright/moltronB-*`:

- `moltronB-final-acquire.log`: all eleven source closures pass.
- `moltronB-final-test.log`: 361 tests pass; no failures or skips. The coverage
  tests also pass after pinning the accepted responsive stage's 1px overscan.
- `moltronB-final-build.log`: 12 pages and all eleven asset packages built.
  No navigation staging or backup files appear in `public/` or `dist/`.
- `moltronB-merge-audit-final-20260904/{baseline,candidate}/report.json`:
  fresh Chrome 152.0.7977.76, all independent coverage checks and twelve
  scene/shell comparisons pass. Zero scene changes; zero shell changes outside
  marker footprints. Thirteen runtime/manifest files and 38 loaded assets match.
- `moltronB-pluto-final-20260904/report.json`: eighteen fresh Chrome captures;
  23 loaded assets hash-verified per display condition; 931 stable nodes;
  prepared affine frames; no page errors or external requests.

- `moltronB-final-browser.log`: full aggregate Chrome suite passes: shell,
  introductions, all 22 desktop/mobile navigation selections, shared conformance
  for all eleven objects, and all eleven package-specific suites. No gates skipped.
- Both the working diff and full PR pass `git diff --check`.

All F1–F9 findings are addressed. Local merge gates pass; this is not a claim of
hosted CI or an independent GitHub approval. No merge or deployment was performed.

Earlier evidence under `object-contract-review-accepted-20260904/` reported
zero scene differences across six conditions, with shell differences of
532/532/1,164 and 2,098/2,098/4,548 pixels within marker footprints. These numbers
describe the intentional atlas change, **not marker-pixel preservation**. The
fresh review-repair run supersedes that run for merge readiness.
