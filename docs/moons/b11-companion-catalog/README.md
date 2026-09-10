# B11: 2001 SN263 and its two moons

The user wants a much larger moon catalog with more selectable bodies, prioritizing moons with useful resolved surfaces or shapes through the existing renderer. This PR adds **two moons, 2001 SN263 Beta and Gamma, plus their primary Alpha**. These three packages are the qualified source subset of the six moon candidates reviewed for this batch. Six reviewed candidates does not mean six shipped moons; Dactyl, Selam, the 2000 DP107 secondary and the 1998 QE2 secondary remain carried forward.

Every addition uses the existing object registry, generic adapter, shared camera, navigation and retained CSS renderer. One body is mounted at a time. The PR prepares the published shapes and context through the existing tools; it introduces no renderer, historical-epoch mode or separate scene owner.

## What becomes selectable

| Body | Package | Published estimated diameter | Useful visible data |
| --- | --- | --- | --- |
| 2001 SN263 Alpha | `asteroid-2001-sn263` | 2.5 ± 0.3 km | Radar and light-curve shape of the primary |
| 2001 SN263 Beta | `sn263-beta` | 0.77 ± 0.12 km | Radar shape of the larger, outer moon |
| 2001 SN263 Gamma | `sn263-gamma` | 0.43 ± 0.14 km | Radar shape of the smaller, inner moon |

The native [PDS SN263 V1.0 models](https://sbn.psi.edu/pds/resource/shape153591.html), interpreted with [Becker et al. (2015)](https://doi.org/10.1016/j.icarus.2014.10.048), each contain 1,148 vertices and 2,292 triangular faces. Their computed equivalent-volume radii are 1.248294, 0.394555 and 0.224203 km respectively. Those precise numbers describe mesh volumes; they do not improve the observational diameter uncertainties.

These are useful observation-constrained shapes. No resolved optical imagery, surface albedo map, composition map or fine terrain is supplied. The moon meshes use radar observations; the primary model also uses light curves. The grid marks missing optical imagery across the body; it is not a radar coverage mask. The archive's weakly observed facet lists remain with the sources. No craters or photographic texture are invented to fill those gaps. Native meshes, labels and per-body source manifests are retained beside [Alpha](../../../src/planets/asteroid-2001-sn263/README.md), [Beta](../../../src/planets/sn263-beta/README.md) and [Gamma](../../../src/planets/sn263-gamma/README.md).

## Orbit interpretation and limits

The mutual-orbit source is [Fang et al. (2011), Table 4, PDF page 6](https://arxiv.org/pdf/1012.2154v2#page=6), checked directly in the original page. Its elements are relative to Alpha in **equatorial J2000** axes at **MJD 54509.0 = JD 2454509.5**, rather than ecliptic axes. Beta is the outer satellite and Gamma the inner satellite.

| Element | Beta | Gamma |
| --- | ---: | ---: |
| Semimajor axis, km | 16.633 | 3.804 |
| Eccentricity | 0.015 | 0.016 |
| Inclination, degrees | 157.486 | 165.045 |
| Ascending node, degrees | 161.144 | 198.689 |
| Argument of periapsis, degrees | 131.249 | 292.435 |
| Mean anomaly at source epoch, degrees | 212.658 | 248.816 |
| Period, days | 6.225 | 0.686 |

The [JPL satellite API response](https://ssd-api.jpl.nasa.gov/sb_sat.api?des=153591&orb=1&sigma=1&phys-par=1) agrees with these orbital angles when matched by semimajor axis, but its unnamed rows pair the physical parameters with the opposite inner/outer orbit. Those physical fields are excluded. Identity follows the original paper and native PDS component labels.

The existing loader evaluates these elements once at the shared **JD 2461286.5 TT** scene epoch. It uses the published mean anomaly and `360 / period`; the displayed mesh orientation does not select orbital phase. Its Python bisection/plane-basis anchors independently check the JavaScript rotation calculation at both epochs. Their 13.869758° mutual inclination also agrees with the paper's approximately 14°.

The following qualifications are retained in the source records and generated state provenance:

- **Time:** the source does not name its clock scale. Its numerical epoch is treated as TT. Equatorial J2000 axes are treated as ICRF at this coarse precision. The geometric states have no light-time correction.
- **Long extrapolation:** 6,777 days separate the source and scene epochs. The paper used a three-body fit and detected precession. This fixed-plane Kepler approximation omits mutual perturbations, primary oblateness, apsidal/nodal precession and later encounters. Both current phase and current orbital plane are unqualified. The paper's adopted period errors alone imply many complete phase wraps; the stored sensitivity values are not present-position confidence bounds. The historical radar residuals have not been replayed.
- **Primary versus system barycenter:** [Horizons numbered asteroid 153591](https://ssd.jpl.nasa.gov/horizons/) supplies the heliocentric anchor, with the exact requests and original responses pinned in each package. That numbered target does not establish a separately resolved Alpha-center state. No measured correction between Alpha and the triple-system barycenter is available; the source mass/orbit model implies a sub-kilometer offset. This is approximate spatial context.
- **Parent clocks and gravity:** the companion anchor request converts UTC to the exact TT scene epoch using 69.184 seconds. The existing asteroid element generator treats TDB as TT within 2 ms. Effective mutual GM is derived from each rounded period and semimajor axis, then split by the published mass ratio for loader consistency. It is not a new mass measurement or a full triple-system gravity solution.
- **Attitude:** the PDS shape model assumes Alpha's pole for both moons. That is not an independently measured secondary pole. Displayed rotational phase is illustrative; no present attitude or libration is established.

The prepared snapshot supports approximate context for these shape models. It is not a current positional ephemeris. The existing satellite loader rejects requests at another epoch.

## Carried-forward candidates

Reviewed 2026-09-09. These are specific gaps in the sources qualified for this PR, not proof that other data cannot exist.

| Candidate | Useful evidence available | Remaining blocker for this catalog |
| --- | --- | --- |
| Dactyl | Galileo resolved images and the orbital-family analysis in [Belton et al. (1996), Table IV](https://doi.org/10.1006/icar.1996.0044). | Numeric Table IV rows were not acquired and verified. The [released encounter SPK](https://naif.jpl.nasa.gov/pub/naif/GLL/kernels/spk/s970311a.bsp.lbl) contains Ida/Galileo but no Dactyl state. A source-backed phase/state and qualified image/attitude controls remain necessary; no guessed current orbit is inserted. |
| Selam | Lucy resolved images and [published two-lobe dimensions](https://pmc.ncbi.nlm.nih.gov/articles/PMC11136651/). The [later geological study](https://elib.dlr.de/221656/) discusses the images, without releasing a Selam mesh. | The retained image reconstruction failed its independent frame prediction, and parent camera controls remain unqualified. The [revised Lucy SPK](https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/spk/lcy_230815_240201_240101_dinkinesh_reconstruction_final_v2.bsp.lbl) has no Selam state. A period and an arbitrary light-curve time origin do not by themselves define an absolute orbital phase. |
| 2000 DP107 secondary | [Naidu et al. (2015), Table 3](https://echo.jpl.nasa.gov/asteroids/naidu.etal.2015.2000dp107.1538-3881_150_2_54.pdf) gives equal-volume ellipsoid axes 0.377 × 0.314 × 0.268 km, each ±6%; the actual radar mesh has a triangular silhouette. | No downloadable secondary mesh was located. An ellipsoid would be a disclosed approximation. The 2015 orbit lacks an absolute phase; the complete historical fit in [Margot et al. (2002), Table 1](https://echo.jpl.nasa.gov/asteroids/margot%2B2002_dp107_science.pdf) has not had its angular reference frame qualified. Its phase must not be silently combined with the 2015 fit. |
| 1998 QE2 secondary | [Deleon et al., LPSC 2026, abstract 1939](https://www.hou.usra.edu/meetings/lpsc2026/pdf/1939.pdf) reports a roughly 0.9 km, two-lobe radar model and a 31.29-hour orbit. | The actual secondary mesh or quantitative lobe dimensions are not supplied; the positional illustration's ellipsoids are not that shape release. Absolute mutual-orbit phase/epoch is also missing. The differing [2025 abstract](https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-880.html) values must not be mixed into the 2026 model. |

## Qualification

Source and arithmetic checks completed in this branch:

- The unchanged published-orbit loader accepts both new moons and their independent source/scene-epoch anchors. The generator retains all six existing-plus-new source-state satellite records.
- Focused astronomy tests passed 41/41: asteroid vectors, scene satellites, body metadata and solar-system frames. Source-loader/generator tests passed 7/7.
- `python3 -B packages/astronomy/tools/verify-sn263-orbits.py` passed the two-epoch, energy, identity and mutual-inclination checks. These verify the approximation's arithmetic, not observational precision at 2026.
- The parent's heliocentric Kepler model was compared with three retained Horizons vector rows. Errors at −30/0/+30 days are 237.661/0.000000431/229.289 km; the 250 km regression bound covers these sampled endpoints only.

All three authored preparations, renderer/preparation builds, source and runtime package closure checks passed. The complete astronomy suite passed **670/670** with one worker. The final focused source, package, navigation and router run passed **89/91**; its two outstanding checks are described below.

The existing browser conformance suite passed **11 cases per body**, including desktop/mobile, both DPRs, dataset interactions and four pre-ready motion/visibility combinations. DOM cleanliness passed at DPR 1 and 2 for every addition: one scene, retained nodes, no topology changes and no canvas/SVG scene renderer. Search navigation through Alpha → Beta → Gamma → Alpha retained the shell. See [visual review and measured costs](VISUAL-REVIEW.md), [browser receipt](evidence/browser.json), and the three [conformance](evidence/conformance-alpha.log) [logs](evidence/conformance-beta.log) [here](evidence/conformance-gamma.log).

All **93 runtime files / 21,168,282 bytes** were published through the existing publisher. Running the ordinary `pnpm setup:assets --object=asteroid-2001-sn263 --object=sn263-beta --object=sn263-gamma` command in an empty installation downloaded 93 files with **zero reuse**; every size and hash matched. The conformance and cost runs served copies of those freshly downloaded files. The [installation receipt](evidence/fresh-install.json) and [source restoration](evidence/source-restoration.json) keep delivery separate from source preparation.

The navigation generator produced the current 435-entry atlas and three new context images. Its remaining 414 context images reuse exact merge-base bytes; 211 were also regenerated and matched byte for byte. Every inherited recipe and preparation dependency was checked. See [navigation reuse](navigation-reuse.json). In the recompressed UI atlases, all 432 inherited alpha channels remain exact; mean premultiplied RGB differences are 0.808/0.325 on a 0–255 scale at DPR 1/2 ([comparison](evidence/atlas-comparison.json)).

**Aggregate qualification remains open; this is a draft PR.** The all-object package test encounters a missing sparse-checkout `polymele/prepared/runtime.json`. The unchanged Phobos fixture has one compiled partition where the existing epoch-refresh test requires more than one, before it calls the code under test. After restoring missing baseline styles, Astro compiled the application and emitted all three new object payloads, then stopped at the absent ignored `polymele/prepared/object.json`. These are not passing whole-repository test/build results. Full `pnpm test`, `pnpm build`/assembly, aggregate acquisition verification and all-object browser sweeps remain unqualified; the branch does not claim merge readiness. Exact commands and logs are retained in [final checks](evidence/final-checks.json).

## Reproduction

With the normal workspace dependencies installed:

```sh
node tools/objects/dist/operations.js acquire asteroid-2001-sn263 --verify-only
node tools/objects/dist/operations.js acquire sn263-beta --verify-only
node tools/objects/dist/operations.js acquire sn263-gamma --verify-only
node tools/objects/dist/prepare-authored.js asteroid-2001-sn263 --write
node tools/objects/dist/prepare-authored.js sn263-beta --write
node tools/objects/dist/prepare-authored.js sn263-gamma --write
node tools/prepare-navigation.mjs
node tools/prepare-object-json.mjs asteroid-2001-sn263 sn263-beta sn263-gamma
node site/minimap/prepare.mjs
```

Run the three preparation commands sequentially. The full navigation command regenerates every context; the bounded reuse receipt documents the actual preparation performed for this PR. `configure.mjs --refresh-pins` maintains the authored source pins without requiring ignored scratch files. It is not a substitute for running the preparation recipes after a source change.

## Original table evidence

The inspected source is [Fang et al. v2, page 6](https://arxiv.org/pdf/1012.2154v2#page=6), 1,028,692 bytes, SHA-256 `9bc4753784e7b5836c254bdae627716935686606163a70a94c2293dc060b3fe7`. This pin is also stored in each moon's published-parameters record.

The paper lists the [arXiv non-exclusive distribution license](https://arxiv.org/licenses/nonexclusive-distrib/1.0/license.html), which grants distribution to arXiv rather than a general third-party redistribution permission. This PR links the original page and retains attributed numerical facts; it does not bundle the PDF or its page image.
