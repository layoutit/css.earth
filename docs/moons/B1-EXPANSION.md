# B1: 26-moon expansion

Status: implementation and qualification in progress. Branch
`feat/moons-26-expansion`, based on merged main `c6850e2839520e32c3e6526bc1fd8a95866a9eb2`.

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
| Astronomy suite | 668 tests pass before main integration; final integrated run pending |
| Source-state, generator and Unicode title checks | 8 tests pass before main integration |
| Parent orbit consistency | 28 solar/planetary, 6 core-context, 4 adapter and 47 renderer tests pass; source r/v, ring closure and hidden-parent transport checked |
| Package lint and type checking | Pass |
| Body acquisition and preparation | All 26 prepared; 80/80 unit tests and 26/26 source verifications pass (478 pinned files) |
| Aggregate source verification | Blocked by 822 unchanged missing pins (12.61 GiB) in 200 existing/incoming-main packages; no B1 pins missing. All pins match their respective merged baselines; see the integrated source-gap report. |
| Aggregate test/build/browser gates | Preintegration production build passes (205 pages); tests exceeded the default 4 GiB Node heap in two audits. Integrated rerun pending with a larger test heap. |
| All 26 real Chrome DPR 1 and 2 checks | Pending |
| Visual inspection | Pending |
| Remote runtime publication and fresh installation | Pass: 874 files / 199,806,888 bytes across 28 affected packages published; fresh remote installation returned 874 HTTP 200 responses with exact SHA-256 and sizes. A second offline run reused all 874 files. |
| Pull request | Not opened |

Preparation and browser evidence stay in the reused Moons worktree. This report
will be finalized with exact command results and artifact locations before the
batch is represented as ready.
