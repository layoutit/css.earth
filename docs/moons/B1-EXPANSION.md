# B1: 26-moon expansion

Status: implementation complete; final qualification in progress. Branch
`feat/moons-26-expansion`. Implementation began at main `c6850e28` and integrates
main `c61d1bf9`. The tested implementation commit is
`2900da4f78e21caa2e08064ec191552c9cd78f97`; later corrections and main integration retain separate validation receipts.

All 26 reviewed candidates now have body-owned source packages and standalone
routes through the existing generic object adapter. The branch registry grows
from 69 to 95 satellite scenes. After integrating main `c61d1bf9` (49 additional asteroids and the shared explorer update), the branch contains 253 objects. Benchmark coverage
rises from 68 to 90 of 461 (19.5%); the four additional companions join Dimorphos
outside that benchmark. No measured global imagery is claimed for these bodies.

## Cohort and representation

| Cohort | Bodies | Supported representation |
|---|---|---|
| Saturn (18) | Paaliaq, Tarvos, Ijiraq, Suttungr, Mundilfari, Skathi, Erriapus, Thrymr, Bebhionn, Bergelmir, Bestla, Fornjot, Hati, Hyrrokkin, Loge, Skoll, Greip, Tarqeq | Minimum elongation from photometry; assumed depth and uncertain scale remain visible. Bestla retains its source-specific pole interpretation. |
| Uranus (4) | Caliban, Sycorax, Prospero, Setebos | Observation-constrained approximations with explicit shape, pole and photometric assumptions. |
| Other companions (4) | Hiʻiaka, Squannit, Romulus, Menoetius | Body-specific occultation, radar or lightcurve constraints; Squannit uses the original radar mesh. |

The neutral coordinate grid communicates geometry without inventing surface
imagery. Every package retains source facts, preparation inputs, display limits,
restorable acquisition pins and content-hashed runtime inventories.

## Orbit and orientation evidence

The 22 Saturn/Uranus fits retain 43 independently queried sample epochs per moon.
Across the 37 additional epochs, maximum sampled residuals are 159,023.06 km,
0.52502 degrees and 0.91862% in radius. These sampled residuals pass the existing
2% radial guard and do not claim continuous or extrapolated accuracy. Full
per-body results and velocity residuals are in each `source/validation/orbit-checks.json`;
the [astronomy README](../../packages/astronomy/README.md#b1-22-irregular-moon-fits-and-four-supported-scene-states)
records the summary table and supported limits.

Haumea and Sylvia are refreshed to the same canonical primary positions used by their new moons. Patroclus supplies a source-backed coordinate origin without becoming a new rendered scene or marker.

The four other companions retain only the supported scene instant, JD 2461286.5
TT. JPL composition validates Hiʻiaka and Menoetius against the correct physical
primaries. Squannit's published model has substantial accumulated phase
sensitivity. Romulus retains actual Miriade projection disagreements, including
140.5 km at the scene date. Both are visibly labeled approximate orbital
projections. Unknown absolute attitudes remain display choices; reported periods
are not silently promoted into a measured pole or rotational phase.

## Qualification ledger

| Check | Current result |
|---|---|
| Full document review | 484/484 reviewed before implementation; frozen evidence retained |
| Astronomy suite | 668 tests pass in the final integrated full-suite run |
| Source-state, generator and Unicode title checks | 8 tests pass before main integration |
| Parent orbit consistency | Final 28 solar/planetary tests and independent metadata/carrier checks pass for all 26 moons; source r/v, ring closure and hidden-parent transport evidence is retained in the science report |
| Package lint and type checking | Pass |
| Body acquisition and preparation | All 26 prepared; 80/80 unit tests and 26/26 source verifications pass (478 pinned files) |
| Aggregate source verification | Blocked by 822 unchanged missing pins (12.61 GiB) in 200 existing/incoming-main packages; no B1 pins missing. All pins match their respective merged baselines; see the integrated source-gap report. |
| Production build | Pass: 254 pages for the integrated 253-object registry |
| Full test suite at `2900da4f` | Package 761, renderer 346 and platform 1,826 tests pass. Shell: 201 pass and 3 file-level CSS import failures; correction pending. |
| Full production browser gate at `2900da4f` | Pass: 506 object/DPR cases, two six-hop navigation sequences and zero browser problems |
| Detailed real Chrome DPR 1 and 2 interaction checks | Pass: all 26 moons plus Haumea and Sylvia, 56 cases; visual acceptance is separate |
| Visual inspection | Five representatives pass; Squannit has confirmed fine raster seams in lossless captures and remains blocked pending correction |
| Remote runtime publication and fresh installation | Pass: 874 files / 199,806,888 bytes across 28 affected packages published; fresh remote installation returned 874 HTTP 200 responses with exact SHA-256 and sizes. A second offline run reused all 874 files. |
| Pull request | Not opened |

## Evidence and limits

- [Final source qualification](b1-preparation/qualification-source.json) records all 26 packages and their 478 pinned files. The earlier run is retained separately.
- [Science integration](b1-preparation/science-integration.md) distinguishes independent source checks from same-model numerical closure. The approximately six-micrometre numerical discrepancy is not a physical accuracy claim.
- [Runtime publication and fresh installation](b1-preparation/runtime-publication-report.md) records the 874-file delivery and the final integration recheck.
- [Aggregate source-gap report](b1-preparation/integrated-source-gap-report.md) identifies every missing baseline input and preserves the actual failing acquisition command.

Canonical state claims cover the generated state map, the current planetary-system preparer, physical world frames and the shared external world context used by the app. Older cached body-local fallback orbit plans are outside this qualification. Preparation of object JSON does not refresh every cached ephemeris.

Preparation and browser evidence stay in the reused Moons worktree. Final command results, full-gate receipts and representative captures are added as the remaining checks finish.
