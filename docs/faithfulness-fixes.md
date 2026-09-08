# Celestial faithfulness corrections

This pass addresses the 28 unique findings from the prerelease review at
`1e0670a5869c2270d0824f5b7fb37a55d92f77ba`. It also includes the unpublished
factsheet pass on which that review was based. The repair branch starts from
main `3eaf498d0c64981b3b1e2224aacc3e48b2dd9dd2`, preserving its 83 registered
bodies. Four reviewed but unmerged asteroid snapshots remain in their own PR.
The twelve newly merged moons are preserved, not claimed to have received the
previous 75-body scientific audit.

## Measurement and rendering corrections

| Review IDs | Correction and qualification |
| --- | --- |
| SB-01, SB-02, SB-03; related Bennu risk | Itokawa, Ryugu, Eros and Bennu transfer radius-derived scalars from the full source triangle surface to the simplified display mesh using bounded closest-point correspondence. Ambiguous radial previews withhold values. The datum and distinction from gravitational height remain explicit. Independent source-coordinate and retained-face cases cover the original failures. |
| JUPITER-POLAR-SPECTRA | Jupiter UV and methane keep Hubble measurements and explicit gaps. Juno structural polar detail no longer supplies unmeasured Hubble spectral values. |
| MARS-THERMAL-FILL | THEMIS missing pixels no longer borrow Viking visible brightness or pole inpainting. Dark valid observations are retained; unavailable areas use the shared gray grid. |
| SATURN-THERMAL-MODEL | The existing procedural colors are named **Thermal illustration / Schematic**. Instrument-response and Cassini-measurement claims are removed. The pixels remain an illustration; no new thermal measurements are claimed. |

Jupiter and Mars source files lack an authoritative validity extension for the
relevant products. The documented conservative mask uses polar/edge-connected
exact-zero fill, preserving isolated zero values and nonzero dark observations.
That inference is a limitation, not an instrument-supplied mask. Tests exercise
valid dark samples and incomplete interpolation footprints.

## Orbital and attitude corrections

| Review IDs | Correction and qualification |
| --- | --- |
| SAT-ORBIT-EPIMETHEUS, SAT-ORBIT-MIMAS, SAT-ORBIT-JANUS, SAT-ORBIT-HELENE, PHOBOS-01, TRITON-01 | Prepared positions use pinned JPL Horizons geometric vectors at the scene epoch. Target, center, frame, units and time scale are validated. The snapshot cannot be used as a general propagator. Body frames and world context are regenerated from those positions. |
| EARTH-CENTER | Earth uses the Earth-center offset from the Earth–Moon barycenter. The Moon is positioned relative to that same corrected Earth center. |
| SAT-ORBIT-DAPHNIS | The visible introduction identifies the 2026 extrapolation of a 2005–2018 fit and the lack of a Horizons ephemeris at that date. It also identifies the arbitrary display attitude. Daphnis's actual position error remains unknown. |
| SAT-HYPERION-ATTITUDE | The introduction identifies illustrative orientation/lighting and the absence of a chaotic-tumbling simulation. |
| SHARED-MOTION | The UI says **Scene epoch** and **Illustrative rotation**, with visible text explaining accelerated rotation and a fixed scene epoch. Image dates remain separately identified. |

The prepared snapshot's raw service responses and manifest live under
`packages/astronomy/source/scene-epoch/`. Numerical tests compare the published
parent-relative positions with these independently acquired responses. Small
residuals elsewhere and models outside this corrected set are not asserted to
be exact ephemerides.

## Visible scientific interpretation

| Review IDs | Correction and qualification |
| --- | --- |
| SHARED-DISCLOSURE | The selected dataset's description is rendered with its minimap. Existing body-owned source, model, coverage and measurement qualifications are promoted from hover-only titles where needed. Proteus explicitly warns that fine image grain is noise, not resolved terrain. |
| SUN-SYNOPTIC | The solar views identify their colorization and CR2311 mosaic interval, 12 May–9 June 2026. AIA off-limb images are separately dated 27 May 2026. Stale source notes are corrected. |
| MOON-01 | The visible-color description identifies the NASA CGI map, inpainted gaps, monochrome LOLA poles and display tone adjustments. GRAIL crust thickness is identified as an inferred model under density assumptions. |
| URANUS-COVERAGE | Descriptions distinguish observed northern Hubble coverage from the uniform unobserved southern baseline. That baseline remains illustrative. |
| NEPTUNE-COVERAGE | Descriptions identify the unobserved cap north of about 30° N and its boundary continuation. Visible color is described as an approximately color-adjusted composite. |
| VENUS-LINEAGE | The OpenSpace cloud texture is labeled an illustration with unresolved original camera, wavelength and color processing. No unsupported wavelength identity is assigned. |
| SAT-TETHYS-RADIUS | The visible introduction separates the 536.3 km display/reference sphere, 531.1 km physical mean radius and 531 km elevation datum. Source notes agree. |

Source notes and recipes retain processing details. Essential interpretation is
visible beside the active dataset, including on touch layouts; alt text and
hover titles are supplementary.

## Factsheet corrections

| Review IDs | Correction and source |
| --- | --- |
| IO-01, EUROPA-01 | Mean sidereal/synchronous periods round to 1.77 and 3.55 days. The pinned review retains the IAU rotation rates and the 360/rate derivation, rather than substituting anomalistic periods. |
| METIS-01 | Discovery imagery is dated to 1979 and distinguished from the 1980 announcement. |
| METIS-02 | Synchronous rotation is explicitly assumed; the actual period is unknown. The supported orbital period is preserved. |
| SB-04 | Toutatis geometric albedo is shown as the approximate NEOWISE estimate 0.41 ± 0.14. The pinned SBDB record retains the nominal value, uncertainty and reference. |

See [factsheet conventions](factsheets.md) for quantity definitions, rounding,
source pins and reproducible publication of facts and editorial metadata.

## Limits

These corrections do not turn cssEarth into a live ephemeris or scientific
measurement tool. Source resolution, photometric approximations, inferred
coverage, inverse-model assumptions and simplified geometry remain body-specific
limits. A successful build or matching file hash cannot establish scientific
fidelity; the relevant independent numerical and browser evidence must accompany
the release decision.
