# Small Magellanic Cloud image intake

Eight source fields were acquired and visually inspected on 2026-09-16. Exact URLs, credits, byte counts, SHA-256 pins, decoded dimensions and embedded AVM are in [candidate-intake.json](candidate-intake.json). Originals and inspection products remain in the ignored local cache. This record describes acquisition; it does not certify registration, star removal or 3D reconstruction.

| Candidate | Raster | Coverage and limits |
| --- | --- | --- |
| VISTA Y/J/Ks | 4000 × 3540 | Main cloud and surrounding stars; publisher derivative of a 43223 × 38236 mosaic. The 4.4 GB PSB was not downloaded. AVM retains the original grid and must be scaled. |
| SMASH g/r/i/z | 3827 × 3190 | Main cloud and surrounding clusters. Existing canonical publisher TIFF reused. Downloaded JPEG is an alternate representation, not another candidate. |
| DSS2 optical | 13096 × 13616 | Main cloud, tighter field than VISTA/SMASH; conspicuous photographic bright-star halos. Full-resolution JPEG; 421.7 MB TIFF deferred. |
| WISE press image | 5855 × 4596 | Main cloud, four infrared bands; satellite streaks visible. Publisher **SIN** AVM must not be treated as TAN. |
| Spitzer SAGE-SMC | 11200 × 6600 | Main body and long tidal-tail region within a stepped survey footprint. Black exterior is no-data. Publisher band table and caption disagree; retain the ambiguity. No embedded AVM. |
| Herschel/Spitzer | 10000 × 5000 | Bar and wing dust; 24–250 micron false colour. Embedded TAN AVM. Compact dust emission is not a foreground-star catalogue. |
| Herschel/gas PIA25164 | 4950 × 4950 | Broad dust and hydrogen distribution, supplemented by Planck/IRAS/COBE and radio observations. No embedded astrometry in PIA TIFF; TAN WCS recovered from the official same-grid Herschel companion. Independent registration remains unverified. |
| AllWISE wide survey | 4000 × 4000 | 10-degree TAN field, W4/W2/W1 logarithmic colour. Same mission as the press image with different field and rendering; not independent depth evidence. |

Publisher WCS is an initial transform, not a passed star-registration gate. AVM values are preserved verbatim. The AllWISE FITS companion supplies an inspected ICRS/TAN header; sampled JPEG comparison supports reversing FITS axis 2 (mean absolute channel difference 1.18 versus 2.62 without reversal). This is an orientation check, not an independent astrometric verification.

No close-up of NGC 346 or NGC 602 was counted as a whole-cloud candidate. Herschel `nhsc2012-001b` and Spitzer `ssc2012-01b` are the same composite and were not duplicated. The public Spitzer mosaic is a display product, not calibrated surface brightness or gas depth.

Scientific archive references are [SAGE-SMC at IRSA](https://irsa.ipac.caltech.edu/data/SPITZER/SAGE-SMC/overview.html), which requests Gordon et al. (2011, AJ 142, 102), and the [final VMC release](https://archive.eso.org/cms/eso-archive-news/final-data-release-of-the-vista-survey-of-the-magellanic-cloud-system-vmc.html), whose footprint includes 28 SMC tiles. Bonanos et al. (2010), CDS J/AJ/140/416, was subsequently acquired as an observed SMC massive-star candidate catalogue: table 1 has 5324 spectral records and table 3 has 3654 photometric records. Original fixed-width tables, ReadMe, hashes and column ranges are retained in `.local/nebula-lab/smc-intake/bonanos2010-receipt.json`. No selection, membership revision or depth assignment has run.

Survey science mosaics were not downloaded in this intake; the separately acquired AllWISE FITS is a survey visualization with WCS, not native detector photometry.

All eight rasters decoded successfully and their cached bytes were hashed after transfer completion. The contact sheet confirms main-cloud coverage, differing handedness/orientation, the Spitzer no-data boundary, photographic halos, and infrared rendering differences. Registration and processing receipts belong to their separate stages; nothing here promotes a physical model or production scene.

The PIA25164 astrometry transfer uses official Herschel `nhsc2022-001c` (4950 × 4950) with its embedded ICRS/TAN AVM. Full native decoded RGB comparison at identical coordinates across 73,507,500 channel samples gives mean absolute difference 1.823/255, RMS 3.383/255 and cosine similarity 0.99763. This supports the common raster grid despite JPEG and publication differences; it is not a star-match gate. The companion URL, hash and full comparison statistics are pinned in the intake.

## Survey band composites

Four composites were built on 2026-09-17 from calibrated or archival survey bands with the shared [sky band compositor](../../../../tools/objects/observation/sky-band-composite.mts). Every band is pinned, and each recipe lives in [candidates/source/sky-bands](candidates/source/sky-bands/). All four share one exact grid: TAN, 4000 × 4000, 10° field, centre RA 13.19°, Dec −72.83° (ICRS). `prepare-overlays` checks each recipe and its tile lists on every run, including when the composite is already cached. It rebuilds a missing composite under a file name that includes its hash.

| Composite | Bands and channels | Acquisition and units | Known limits |
| --- | --- | --- | --- |
| `smc-dss2-fits` | DSS2 red plate → red, DSS2 blue plate → blue, green = their mean (the convention of the CDS DSS2 colour survey) | CDS hips2fits, pinned by sha256 and byte count. Relative photographic units, with no flux calibration | Saturated plate stars are masked as no coverage (below). Plate-to-plate level steps remain: plate footprints are not in the pinned inputs |
| `smc-wise-stellar` | W2 → red, W1 → blue, green = mean | 61 AllWISE atlas tiles per band, background-matched. MJy/sr from Explanatory Supplement factors | A smooth W2 background gradient toward the south-east remains |
| `smc-wise-starforming` | W4 → red, W3 → green, W1 → blue | As above | In faint regions W4 is dominated by noise and small leftover tile levels. W3 shows Galactic cirrus and scattered-light streaks to the east |
| `smc-herschel-dust` | SPIRE 250 µm, monochrome | ESASky Herschel HiPS through hips2fits. The HiPS declares no unit, so values are relative | Only the main body is covered. NaN stays missing, shown as black. Dark stripes from individual scans remain |

W1 is the blue channel of the star-forming composite. This follows the WISE colour convention of wavelength order, with the shortest band as blue. It also puts the catalogue stars in the channel the registration gate reads. PACS 100 and 160 were inspected and left out. In these HiPS the extended emission is filtered out: the maps show only compact knots, with dark bowls around them. SPIRE 250 already shows the extended dust. The per-band comparison is in the ignored `output/smc-vmc/fits-lenses/work/herschel-compare.png`.

Changes the shared tools needed:

- **Tile selection.** The earlier selection picked tiles by bounding box, which could pin a rotated tile that lies wholly outside the grid (`3471m773`). The compositor then correctly refused it. Selection now tests the footprint polygon itself.
- **Edge slivers.** One tile, `3558m697`, covers a 94-pixel sliver at the grid edge. It overlaps its neighbours by too little to fix its level. The mosaic now leaves out such a tile only when joined tiles cover every one of its pixels, and records it as `excludedTiles`. A tile that covers any sky of its own is still refused.

**Registration.** `node labs/nebula/run.mts register-sky-bands labs/nebula/models/smc/registration/sky-band-registration.json` runs the fixed-WCS catalogue gate against the same pinned AllWISE query (W1 magnitude 8–11 stars), then the same-grid transfers, and finally re-runs the already qualified AllWISE image and three known-bad controls. It writes `registration/*-catalogue-gate.json`, `*-grid-transfer.json`, `*-catalogue-diagnostic.json` and `*-negative.json`, and exits non-zero if a check fails or a control qualifies.

The chance control in the gate is density-aware. The earlier rule compared each shifted control with a tenth of the real matches, which penalised deeper or sharper rasters simply for detecting more real sources: these lossless composites detect 105,000–259,000 sources against 36,093 in the qualified AllWISE JPEG, and their controls returned exactly what coincidence predicts at those densities. The gate now measures the excess over that chance rate inside the 0.75-pixel chance radius, which is the protocol's own median limit. Real close matches must be at least five times the largest chance estimate, taken as the larger of every shifted and wrong-transform control count in that radius and the analytic rate `N_catalogue · (1 − exp(−N_detections · π r² / A))`. The held-out median (≤ 0.75 px) and P90 (≤ 1.5 px) limits, the match count, quadrant and hull requirements are unchanged.

| Image | Close matches | Chance estimate | Ratio | Held-out median / P90 (px) | Gate |
| --- | ---: | ---: | ---: | --- | --- |
| AllWISE 10° HiPS (already qualified) | 7,153 | 53 | 135 | 0.233 / 0.384 | **Pass**, evidence unchanged |
| AllWISE W2/W1 composite | 7,096 | 229 | 31.0 | 0.131 / 0.244 | **Pass** |
| AllWISE W4/W3/W1 composite | 7,140 | 110 | 64.9 | 0.028 / 0.072 | **Pass** |
| DSS2 blue/red composite | 5,068 | 219 | 23.1 | 0.314 / 1.006 | **Pass** |
| SPIRE 250 composite (diagnostic only) | 31 | 33 | 0.94 | 1.660 / 2.267 | Fail: median, P90, hull, chance |
| AllWISE, reference pixel shifted 40 px | 32 | 45 | 0.71 | 1.677 / 2.385 | Refused |
| AllWISE W2/W1 composite, shifted 40 px | 215 | 250 | 0.86 | 1.761 / 2.397 | Refused |
| WISE press image on its publisher SIN WCS | 109 | 40 | 2.73 | 1.682 / 2.344 | Refused |

The three negative controls are the regression: a dense composite with a deliberately shifted reference pixel keeps a ratio near one, and the WISE press image on its own SIN astrometry stays below the margin and also fails the residual limits. `fixed-catalogue.test.ts` locks these recorded numbers in. The AllWISE re-run reports identical matches, residuals, hull and quadrants, and the same matched-star table hash as before; only the protocol fields changed. The relative star-pattern registrations of VISTA, SMASH, DSS2 and Horálek use the unchanged Python routine and are untouched, as are the recorded failures of the WISE press image, Spitzer and Irida.

SPIRE 250 has too few point sources for its own gate, so it inherits the grid from the AllWISE W2/W1 composite through `smc-herschel-dust-grid-transfer.json`: both are pinned to bytes that only the compositor can produce, and the compositor checks every band header against this exact TAN grid. That transfer qualifies the request grid and its pixel convention, not the Herschel HiPS survey's own astrometry. Its own failing gate is kept beside it as a diagnostic.

**Star removal.** Before/after crops showed that NOX erases compact dust: the five brightest knots kept only 38% of their compact excess in W4 and 73% in SPIRE 250 (`output/smc-vmc/fits-lenses/wise-starforming-w4-nox-crops.png` and `herschel-dust-nox-crops.png`). The two dust and PAH composites therefore use the observation lane's identity treatment, configured per image in [processing-plan.json](processing-plan.json) with its reason. That treatment writes the source itself as the diffuse layer and an empty star layer, and its receipt is re-proved from the pinned source on every read, so a "preserved" result that is not the identity of its source can never restore. The optical composites keep native NOX.

| Composite | Treatment | Baseline result | Lens result |
| --- | --- | --- | --- |
| DSS2 blue/red | NOX | `22c714c9…` | `4883473b…` |
| AllWISE W2/W1 | NOX | `c310f4c2…` | `cfc1b237…` |
| AllWISE W4/W3/W1 | Preserve | `d5920356…` | `6f05ac57…` |
| Herschel SPIRE 250 | Preserve | `a227754d…` | `ce0197e3…` |

**Saturated plate stars and no coverage.** A scanned Schmidt plate saturates, and NOX leaves the bright core and photographic halo behind as a blob of invented galaxy light. Saturation is measured from the plate scan itself: a core counts as saturated where a ring still sits within 98% of the peak two pixels out or further, which a point spread function cannot produce at 9 arcsecond sampling, and the halo is grown until the ring median reaches the plate's own measured background. The red plate has 7 such cores over 88,902 pixels and the blue plate 41 over 263,803 pixels, with masked radii from 8 to the declared 120-pixel bound.

Those pixels are neither galaxy light nor zero. The composite recipe now declares `"coverage": "alpha"`, the composed PNG carries an alpha channel, and that channel survives to the place the fit reads coverage: `rectifyObservation` resamples the declared mask with a nearest kernel and refuses any output pixel with a masked contributor, and the original overlay marks a pixel covered only where the geometry **and** the source agree. The DSS2 baseline's coverage drops from 90.8% to 89.1% of its rectified frame, and the Herschel baseline — whose off-footprint black was previously read as observed zero emission — from 90.8% to 26.1%, which is its true SPIRE footprint. Before and after crops: `output/smc-vmc/fits-lenses/dss2-saturation-crops.jpg`.

**Plate-to-plate background steps are not corrected.** The steps are real and visible: a robust 10th-percentile background map at 40-pixel cells shows straight-edged plate regions, and the median step across a region boundary is about 360 counts on a 1,938-count sky in the red plate. They are not corrected, because the plate identities and footprints are not in the pinned inputs and could not be recovered from them. A first attempt segmented that background map by its own neighbour steps and solved one constant per region with the shared Montage-style solver; the result was rejected here rather than shipped, because at this cell size the SMC's own extended light produces larger cell-to-cell differences than the seams, so the segmentation cut out galaxy islands and assigned them offsets of ±1,250 counts. Correcting this needs either a pinned plate-footprint table, for which no machine-readable source was found, or a line-aware seam detector that uses the straightness of a plate edge. Until then the straight plate edge remains in the render, and the composite says so.

All four are baked as finite lenses on model `ed90b7bc…` and switch in the Model tab of `?subject=smc-constrained`; the stars toggle still works. Screenshots and the check report are in `output/smc-vmc/fits-lenses/`.

Credits: Digitized Sky Survey (STScI/NASA; UK Schmidt plates, ROE/AAO) with CDS HiPS; NASA/JPL-Caltech/UCLA WISE AllWISE Atlas via IRSA; ESA Herschel/SPIRE through the Herschel Science Archive with ESASky HiPS; CDS hips2fits.
