# B2 qualification checkpoint

All 13 approved bodies have prepared scientific upgrades and actual Chrome DPR 1/2 captures. Final qualification is **incomplete**: aggregate source verification and tests failed, the production build failed with exit 134, Europa's final legend/capture work was pending, and newer upstream work still needed integration. Captured images are not automatically visually approved.

This records the working tree reporting HEAD `bbcec2636f0d40d77a215c49332d51918882fb3a`, following PR #56 integration at `7030be3b`. The captures additionally pin their prepared/configuration/source bytes, because subsequent CSS and legend corrections were present in the working tree. Main `e23a357b86d97b0400f5ab53f8eaf9faf2acd6ec` adds PR #60 Galileo/Dimorphos and PR #53 shell work; the evidence here does not qualify that later integration. Exact log hashes, counts, capture selection and limits are in the [machine-readable ledger](qualification-checkpoint.json).

## Scope and source evidence

The approved cohort is Moon, Phobos, Deimos, Dimorphos, Io, Europa, Ganymede, Enceladus, Tethys, Dione, Rhea, Titan and Charon. These are upgrades to existing scenes, not 13 new moons. The user explicitly moved Titania and Miranda to B3; their GIS releases remain access-blocked, not absent. The frozen survey remains **484/484 rows reviewed, zero unreviewed**; source dispositions and implementation qualification are separate.

The [13-body source checkpoint](source-closure-13.json) verified all **424 declared entries, 3,406,914,307 bytes**, against actual inventory, lengths and SHA-256. Independent checks cover source units/datums, sampled coordinates, original row identity, partial coverage and missing values. The [local runtime checkpoint](runtime-asset-closure-13.json) verified **547 image files, 311,930,930 bytes**. These historical receipts predate final legend changes and need a final current-file comparison. Neither establishes remote publication or fresh installation. Product-by-product source selections and preparation receipts remain in the [B2 tracker](../B2-SCIENTIFIC-SURFACES.md).

## Tests and gates

| Evidence | Actual result | Boundary |
| --- | --- | --- |
| Earlier [focused checkpoint](focused-checks.json) | 30 passed | Predates PR #56 integration; repeated later tests are not additional unique coverage. |
| [Body validation attempt](qualification-logs/b2-body-validation.log) | Moon 14, Phobos 1, Deimos 1, Dimorphos 4 passed; Io then had 2 stale map-test failures | Complete command failed. The [later Jovian run](qualification-logs/b2-jovian-atlas-tests.log) passed 16 checks, including both affected Io checks. |
| [Outer-body validation](qualification-logs/b2-outer-body-validation.log) | 19/19 passed | Enceladus 1; Tethys 4; Dione 4; Rhea 5; Titan 3; Charon 2. |
| [Preparation/contract attempt](qualification-logs/b2-final-preparation-tests.log) | 77/78 passed | One measured-elevation-only fixture retained an incoming observation. After fixture isolation, the [affected file rerun](qualification-logs/b2-scientific-raster-fixture-rerun.log) passed 13/13. The original failed receipt is preserved. |
| [Aggregate source verification](qualification-logs/b2-aggregate-acquire.log) | Exit 1 after 28 bodies | First blocker: comet-1p starfield and Inter font. Its manifest SHA is identical at merged B1, this HEAD and latest main. This is not a new full-registry missing-source census. |
| [Aggregate `pnpm test`](qualification-logs/b2-aggregate-test.log) | Exit 1 | Packages 761 passed; renderer 348 passed; platform 1,666/1,811 passed, 145 failed; shell not reached. |
| [Production `pnpm build`](qualification-logs/b2-production-build.log) | Exit 134 | Package/renderer/preparation builds, object JSON and minimap preparation completed. Astro aborted at its heap limit; assembly was not reached. The earlier [running extract](qualification-logs/build-running-extract.txt) remains historical. |
| Full `pnpm test:browser` | No completed full-gate receipt | Scientific capture runs and prior Phobos per-case conformance are narrower evidence. |

The 145 platform failures comprise 71 prepared-definition digest mismatches, 71 activation-bank digest mismatches, two audit worker heap failures and one compiled-source-carrier fixture assertion. All 71 digest-mismatch bodies are outside B2. A clean-baseline reproduction was not performed for every failure; their locations alone do not justify calling them pre-existing. Existing/incoming-main bulk source inputs were not restored as part of this cohort.

## Chrome captures and manual review

The initial complete run, `capture-2026-09-09T02-52-04.355Z`, contains **26 body/DPR cases, 162 lens/lighting states, 412 PNGs and 84 drags**, with zero recorded case errors and completed browser closure. Visual inspection nevertheless found four absent native Saturn globes caused by stale CSS selectors, proving why successful capture is insufficient for approval.

The corrected six-body run, `capture-2026-09-09T03-04-30.918Z`, replaces both DPRs for Enceladus, Tethys, Dione and Rhea after the CSS fix, and for Io and Ganymede after legend corrections. It contains 12 cases, 76 states, 194 PNGs and 38 drags, with zero case errors and completed closure. Selecting those replacements and retaining the unaffected initial cases leaves **26 cases / 162 states / 412 PNGs / 84 drags**. The six earlier invalid harness attempts are separately retained and excluded. Europa's final replacement capture is still pending at this checkpoint.

Explicit agent image inventories account for **124 retained reviewed PNGs across ten bodies**, plus nine superseded failed Enceladus images. They are the [four-body review](visual-reviews/four-body/review.md), [corrected Saturn review](visual-reviews/saturn-corrected.md), and the retained Titan/Charon portions of the [initial Saturn review](visual-reviews/saturn-initial.md). Root separately reports reviewing corrected Io/Ganymede views; that judgment is attributed to root and is not folded into the agent image count. Other captured images remain unreviewed unless the owner adds an explicit inventory.

The corrected native globes are visible and the inspected scientific legends, masks and interpretation limits are readable. Remaining visual limits include inherited Moon pole/band seams, thin dotted boundaries on Phobos/Deimos and the three larger native Saturn moons, and colored triangle lines in Dimorphos elevation. The Phobos atlas is opaque and lacks the screen's dark line; its retained edges are paired, but the mounted coverage/depth/facing cause is unisolated. Detailed limits and exact screenshots remain in the reviews. No high-zoom, explicit pole-closeup, full-longitude, mobile, native-pixel-parity or compositor-frame-rate qualification is implied.

## Remaining closure

Finish Europa legend/capture work, prove current prepared-file identity, integrate newer main, and record source/runtime and aggregate gate outcomes for that resulting tree. The failed production build remains a failed gate until a subsequent qualifying run completes. Preserve these receipts as historical evidence rather than rebinding them to a later commit. No B2 readiness, PR, publication or deployment claim is made in this checkpoint.
