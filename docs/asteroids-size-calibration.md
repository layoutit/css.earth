# Exceptional asteroid size calibration

This addition brings asteroid coverage from 90 to 139 by qualifying 49 candidates from the [exceptional-asteroid survey](asteroid-candidate-survey.json) that had original shape meshes but lacked physical scale in the DAMIT archive. Original model coordinates and connectivity remain unchanged in the pinned inputs. The existing physical-units reader applies one documented uniform scale per body.

Each body has a shared-grid Shape view, source-derived Elevation, and optional Shadows that start off. Preparation uses the existing source-meshoptimizer path, 800 native PolyCSS `u` raster triangles, and 128 px cells. The application keeps the generic object adapter, one mounted scene, shared search and the Solar System asteroid accordion.

## What the size means

Light-curve inversion constrains overall shape and rotation; it does not supply registered surface imagery. The grid communicates that missing imagery. Convex models do not resolve craters, boulders or hidden concavities.

A published volume diameter is preferred where it can be tied to the model family. Most other calibrations are thermal effective diameters: interpreting them as the model's volume diameter is an explicitly qualified approximation. The original mesh's actual integrated volume determines the conversion; the pipeline never assumes an uncalibrated archive mesh has unit volume. Massalia is a useful independent check because its original numerical volume is about 35.13 source units cubed.

The table lists the selected diameter and quoted error, except Schorria whose 1.11 km minimum follows the source-prescribed 20% floor. These uncertainties are not interchangeable confidence intervals: IRAS flux errors and formal WISE fit errors omit some model systematics. The per-body SOURCE records preserve survey floors, shape/aspect effects, alternative measurements and exact evidence hashes. Scale uncertainty also affects Elevation, which is source-surface radius minus the reference sphere, not independently measured topography or gravitational height.

| Number | Body and provenance | DAMIT model | Selected diameter (km) | Size error / floor (km) |
| --- | --- | ---: | ---: | ---: |
| 20 | [Massalia](../src/planets/massalia/SOURCE.md) | [16321](https://damit.cuni.cz/projects/damit/asteroid_models/view/16321) | 147.0 | 2.0 |
| 26 | [Proserpina](../src/planets/proserpina/SOURCE.md) | [1189](https://damit.cuni.cz/projects/damit/asteroid_models/view/1189) | 87.45 | 0.95 |
| 33 | [Polyhymnia](../src/planets/polyhymnia/SOURCE.md) | [5163](https://damit.cuni.cz/projects/damit/asteroid_models/view/5163) | 53.98 | 0.91 |
| 35 | [Leukothea](../src/planets/leukothea/SOURCE.md) | [867](https://damit.cuni.cz/projects/damit/asteroid_models/view/867) | 111.48 | 1.85 |
| 50 | [Virginia](../src/planets/virginia/SOURCE.md) | [12738](https://damit.cuni.cz/projects/damit/asteroid_models/view/12738) | 84.37 | 0.82 |
| 60 | [Echo](../src/planets/echo/SOURCE.md) | [1695](https://damit.cuni.cz/projects/damit/asteroid_models/view/1695) | 58.95 | 1.24 |
| 66 | [Maja](../src/planets/maja/SOURCE.md) | [1233](https://damit.cuni.cz/projects/damit/asteroid_models/view/1233) | 71.79 | 0.92 |
| 99 | [Dike](../src/planets/dike/SOURCE.md) | [1144](https://damit.cuni.cz/projects/damit/asteroid_models/view/1144) | 66.5 | 0.9 |
| 139 | [Juewa](../src/planets/juewa/SOURCE.md) | [5985](https://damit.cuni.cz/projects/damit/asteroid_models/view/5985) | 166.69 | 2.77 |
| 154 | [Bertha](../src/planets/bertha/SOURCE.md) | [939](https://damit.cuni.cz/projects/damit/asteroid_models/view/939) | 185.83 | 2.72 |
| 222 | [Lucia](../src/planets/lucia/SOURCE.md) | [523](https://damit.cuni.cz/projects/damit/asteroid_models/view/523) | 52.82 | 0.6 |
| 323 | [Brucia](../src/planets/brucia/SOURCE.md) | [10666](https://damit.cuni.cz/projects/damit/asteroid_models/view/10666) | 37.29 | 0.76 |
| 333 | [Badenia](../src/planets/badenia/SOURCE.md) | [3298](https://damit.cuni.cz/projects/damit/asteroid_models/view/3298) | 69.73 | 2.8 |
| 400 | [Ducrosa](../src/planets/ducrosa/SOURCE.md) | [352](https://damit.cuni.cz/projects/damit/asteroid_models/view/352) | 34.1 | 0.5 |
| 444 | [Gyptis](../src/planets/gyptis/SOURCE.md) | [5394](https://damit.cuni.cz/projects/damit/asteroid_models/view/5394) | 166.03 | 6.66 |
| 482 | [Petrina](../src/planets/petrina/SOURCE.md) | [1152](https://damit.cuni.cz/projects/damit/asteroid_models/view/1152) | 44.2 | 1.0 |
| 490 | [Veritas](../src/planets/veritas/SOURCE.md) | [833](https://damit.cuni.cz/projects/damit/asteroid_models/view/833) | 118.803 | 1.83 |
| 496 | [Gryphia](../src/planets/gryphia/SOURCE.md) | [6121](https://damit.cuni.cz/projects/damit/asteroid_models/view/6121) | 14.403 | 0.394 |
| 500 | [Selinur](../src/planets/selinur/SOURCE.md) | [5480](https://damit.cuni.cz/projects/damit/asteroid_models/view/5480) | 40.828 | 0.247 |
| 588 | [Achilles](../src/planets/achilles/SOURCE.md) | [3934](https://damit.cuni.cz/projects/damit/asteroid_models/view/3934) | 131.0 | 8.0 |
| 600 | [Musa](../src/planets/musa/SOURCE.md) | [504](https://damit.cuni.cz/projects/damit/asteroid_models/view/504) | 25.115 | 0.221 |
| 700 | [Auravictrix](../src/planets/auravictrix/SOURCE.md) | [1654](https://damit.cuni.cz/projects/damit/asteroid_models/view/1654) | 16.421 | 0.362 |
| 715 | [Transvaalia](../src/planets/transvaalia/SOURCE.md) | [3722](https://damit.cuni.cz/projects/damit/asteroid_models/view/3722) | 25.458 | 0.591 |
| 787 | [Moskva](../src/planets/moskva/SOURCE.md) | [515](https://damit.cuni.cz/projects/damit/asteroid_models/view/515) | 31.962 | 0.789 |
| 800 | [Kressmannia](../src/planets/kressmannia/SOURCE.md) | [382](https://damit.cuni.cz/projects/damit/asteroid_models/view/382) | 15.429 | 0.325 |
| 888 | [Parysatis](../src/planets/parysatis/SOURCE.md) | [5820](https://damit.cuni.cz/projects/damit/asteroid_models/view/5820) | 44.749 | 0.37 |
| 900 | [Rosalinde](../src/planets/rosalinde/SOURCE.md) | [561](https://damit.cuni.cz/projects/damit/asteroid_models/view/561) | 19.618 | 0.057 |
| 933 | [Susi](../src/planets/susi/SOURCE.md) | [5856](https://damit.cuni.cz/projects/damit/asteroid_models/view/5856) | 21.82 | 1.4 |
| 944 | [Hidalgo](../src/planets/hidalgo/SOURCE.md) | [1057](https://damit.cuni.cz/projects/damit/asteroid_models/view/1057) | 61.4 | 12.7 |
| 999 | [Zachia](../src/planets/zachia/SOURCE.md) | [5901](https://damit.cuni.cz/projects/damit/asteroid_models/view/5901) | 16.848 | 0.182 |
| 1000 | [Piazzia](../src/planets/piazzia/SOURCE.md) | [3529](https://damit.cuni.cz/projects/damit/asteroid_models/view/3529) | 47.78 | 2.0 |
| 1095 | [Tulipa](../src/planets/tulipa/SOURCE.md) | [1779](https://damit.cuni.cz/projects/damit/asteroid_models/view/1779) | 27.875 | 0.362 |
| 1111 | [Reinmuthia](../src/planets/reinmuthia/SOURCE.md) | [678](https://damit.cuni.cz/projects/damit/asteroid_models/view/678) | 24.38 | 0.48 |
| 1125 | [China](../src/planets/china/SOURCE.md) | [1119](https://damit.cuni.cz/projects/damit/asteroid_models/view/1119) | 26.084 | 0.199 |
| 1140 | [Crimea](../src/planets/crimea/SOURCE.md) | [403](https://damit.cuni.cz/projects/damit/asteroid_models/view/403) | 29.179 | 0.155 |
| 1171 | [Rusthawelia](../src/planets/rusthawelia/SOURCE.md) | [3188](https://damit.cuni.cz/projects/damit/asteroid_models/view/3188) | 67.986 | 1.091 |
| 1235 | [Schorria](../src/planets/schorria/SOURCE.md) | [5955](https://damit.cuni.cz/projects/damit/asteroid_models/view/5955) | 5.55 | 1.11 |
| 1317 | [Silvretta](../src/planets/silvretta/SOURCE.md) | [513](https://damit.cuni.cz/projects/damit/asteroid_models/view/513) | 26.393 | 0.439 |
| 1449 | [Virtanen](../src/planets/virtanen/SOURCE.md) | [1175](https://damit.cuni.cz/projects/damit/asteroid_models/view/1175) | 9.263 | 0.098 |
| 2309 | [Mr. Spock](../src/planets/mr-spock/SOURCE.md) | [4874](https://damit.cuni.cz/projects/damit/asteroid_models/view/4874) | 19.707 | 0.177 |
| 2440 | [Educatio](../src/planets/educatio/SOURCE.md) | [9541](https://damit.cuni.cz/projects/damit/asteroid_models/view/9541) | 6.586 | 0.128 |
| 2938 | [Hopi](../src/planets/hopi/SOURCE.md) | [10234](https://damit.cuni.cz/projects/damit/asteroid_models/view/10234) | 19.267 | 0.147 |
| 3333 | [Schaber](../src/planets/schaber/SOURCE.md) | [10836](https://damit.cuni.cz/projects/damit/asteroid_models/view/10836) | 26.538 | 0.262 |
| 5000 | [IAU](../src/planets/iau/SOURCE.md) | [12740](https://damit.cuni.cz/projects/damit/asteroid_models/view/12740) | 4.242 | 0.917 |
| 6000 | [United Nations](../src/planets/united-nations/SOURCE.md) | [1154](https://damit.cuni.cz/projects/damit/asteroid_models/view/1154) | 11.0 | 0.295 |
| 8888 | [Tartaglia](../src/planets/tartaglia/SOURCE.md) | [15683](https://damit.cuni.cz/projects/damit/asteroid_models/view/15683) | 13.584 | 0.067 |
| 9165 | [Raup](../src/planets/raup/SOURCE.md) | [5835](https://damit.cuni.cz/projects/damit/asteroid_models/view/5835) | 4.839 | 0.167 |
| 77777 | [2001 QW16](../src/planets/asteroid-2001-qw16/SOURCE.md) | [15015](https://damit.cuni.cz/projects/damit/asteroid_models/view/15015) | 10.403 | 0.259 |
| 80000 | [1999 FR33](../src/planets/asteroid-1999-fr33/SOURCE.md) | [15145](https://damit.cuni.cz/projects/damit/asteroid_models/view/15145) | 5.754 | 0.174 |

Massalia uses the 2026 archive model and discloses that its size comes from a separate reconstruction. Dike, Ducrosa and Petrina use published thermophysical size estimates for their model families, including the nominal-pole versus varied-model qualifications. Achilles uses occultation scaling. Hidalgo uses measured thermal data rather than an assumed-albedo size. Rusthawelia and Silvretta retain conflicting published size estimates in their source records.

Gryphia is a known tumbler without a complete rotational solution. Its historical principal-axis shape approximation uses the existing fixed illustrative orientation and does not propagate the archived period as a physical spin. Other model poles and periods retain arbitrary display phase; optional lighting is not an absolute observation-time registration.

All heliocentric display fits use the existing JD 2461286.5 epoch and independent Horizons vectors. This is a dated set of source-qualified additions, not all known asteroids or every name in Wikipedia. Survey entries without suitable original models remain explicit gaps.

## Qualification

All 49 bodies passed the source-to-prepared checks below. These establish faithful preparation at the adopted physical scale, not agreement with independently observed terrain. Published shape and pole uncertainties, thermal-model systematics, size-transfer limitations and arbitrary display phase remain applicable; derived Elevation inherits those uncertainties.

| Check | Result and qualification |
| --- | --- |
| Mesh fit | 8,192 area-stratified samples in each direction per body, compared with exact nearest triangle points. The largest observed error relative to its configured limit was Massalia: **791.9 m / 1,470 m = 53.9%**. All sampled errors stayed below their limits; finite sampling does not prove a global Hausdorff bound. |
| Source scalar | **39,494 independent queries** against all original source triangles, covering every retained face center and six source extrema per body, passed correspondence checks. |
| Decoded atlas | **573 interior pixel anchors**, each checked in the flood and shadow WebPs; maximum RGB channel error **7/255**, within the established tolerance of 12. Bleed coordinates/scalars were also checked; boundary RGB remains diagnostic. |
| Visual comparison | **196 inspected views**, four source-versus-prepared pairs per body. Each shape was normalized to its own maximum radius; these establish visible shape retention, not equal physical framing or browser pixel parity. |

Each prepared body has 800 native raster triangles. The preparation reports no withheld interior elevation texels. The shared grid marks absent surface imagery; source-backed size calibration does not create measured surface texture or topography.

[Full scientific evidence](asteroids-size-calibration-scientific-evidence.tar.gz) contains the pinned query results, exact comparison images, inspection records and verification helpers (40.65 MB compressed).

### Complete baseline checks: `863c3adf`

Source verification and full `pnpm test` passed with an 8 GiB Node heap, as did all 49 prepared-package checks, production build and assembly. Primary and fresh-checkout Chrome matrices completed **196 cases**: all 49 additions at DPR 1/2 in both checkouts. Each retained 800 native raster triangles through lens/shadow changes and native drag. The standard DOM browser checks also passed for all 49 at both DPRs. Overview and mobile checks passed; Shadows and asteroid orbits started off.

Normal fresh `pnpm install --frozen-lockfile` reproduced **all 227 compiled object documents byte for byte**. Runtime installation downloaded all **1,715 asteroid assets**, with zero reused assets, totaling **382,888,406 inventory bytes**. Independent normal source acquisition then restored and verified **1,420 manifest entries across all 49 bodies**. This was a fresh checkout on the existing macOS arm64 host with Node 24.19.0 and its installed browser.

[Selected default views](https://github.com/layoutit/cssEarth/blob/feat/asteroids-wikipedia-models/docs/asteroids-size-calibration.webp) · [All 49 default views](https://github.com/layoutit/cssEarth/blob/feat/asteroids-wikipedia-models/docs/asteroids-size-calibration-gallery.webp)

### Final main integration: `7b59763e`

The final application incorporates main `c6850e28`, including its shared orbit-renderer and comet updates. **74 focused tests passed**, production built **228 pages**, and all **227 objects assembled**. All **1,749 checked public/dist assets** matched their pins: the 1,715 asteroid assets and 34 incoming comet assets. All 49 asteroid packages and compiled payloads remained byte-identical to `863c3adf`.

Preparation verified 225 unchanged compiler-input closures. A partial normal pass produced 75 objects: 74 matched the baseline and the updated comet changed as expected. The remaining 152 payloads were reused, then the normal targeted entry point prepared Sun and comet 67P. All 227 resulting compiled payloads match the baseline except the comet; the Sun's 226-body world context includes the incoming orbit metadata. The complete 227-body fresh-postinstall comparison and full suites above belong to `863c3adf`.

Dike, Massalia, Gryphia, IAU, Schorria and Tartaglia completed final DPR 1/2 browser checks; overview at both DPRs and mobile also passed. The body harness hung during cleanup after Chrome exited and was stopped with SIGTERM. Its `exitCode: null` is preserved; all 12 completed cases were independently revalidated against production-file hashes before only overview/mobile resumed.

### Final drag measurements

Twelve native mouse-drag traces at `7b59763e` covered the five additions below plus Pallas as a reference, at DPR 1/2 in headless Chrome 152.0.7977.76. Each measured about 2.5 seconds at a 1505 × 1237 CSS-pixel viewport, with optional Shadows enabled. All drags moved the scene with no recorded errors.

| Body | Draw events/s, DPR 1 / 2 | Draw-event p95 ms, DPR 1 / 2 |
| --- | ---: | ---: |
| Pallas (reference) | 59.41 / 59.01 | 3.71 / 3.60 |
| Dike | 59.40 / 59.01 | 9.40 / 9.30 |
| Massalia | 59.40 / 58.98 | 9.58 / 9.55 |
| Gryphia | 58.99 / 59.03 | 8.18 / 8.14 |
| Schorria | 59.39 / 59.03 | 7.17 / 7.81 |
| Tartaglia | 59.02 / 59.40 | 8.14 / 8.25 |

Cadence uses Chrome's traced `DrawFrame` events; duration is `DirectRenderer::DrawFrame`. These measurements describe the recorded headless workload, rather than display presentation latency or performance on every device. Browser response interception binds the delivered production-file bytes and does not measure HTTP transfer timing.

[Complete qualification record](asteroids-size-calibration-validation.json) · [Browser evidence and raw traces](asteroids-size-calibration-browser-evidence.tar.gz). The archive preserves the full browser receipts, selected captures, normal-installation and source-restoration receipts, the cleanup interruption, and all 12 raw traces with their hashes.
