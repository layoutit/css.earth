# Pleiades (M45): source evidence and 3D experiment

Current Alignment selection: **NOIRLab optical, both Spitzer composites and WISE**. All four pass the existing relative-star checks. 2MASS is hidden because it mainly supplies stellar context; IRIS is hidden because its coarse beam and unverified placement offer little usable nebular structure here. All six original records remain preserved.

Six original image records remain pinned. The four selected sources now have
complete native NOX separation and structure maps. A separate
[processing recipe](processing-observations.json) preserves the full source
rasters and 252-arcminute common frame while excluding 2MASS and IRIS from
processing. Neither archived source was star-removed or reconstructed.

## Sources

The [observation recipe](observations.json) records exact downloaded bytes,
SHA-256, dimensions, credits, source URLs, full footprints and WCS. The
[source dossier](source-dossier.json) adds band assignments, observation/release
intervals, sampling versus resolution, original-master access and limitations.
Large originals remain in the ignored local intake cache.

| Candidate | Bands | Acquired image | Coverage and role |
| --- | --- | --- | --- |
| [NOIRLab optical](https://noirlab.edu/public/images/noao-m45/) | B/V/I: 436/537/805 nm | 4000 × 2920 RGB8 TIFF; 25,288,332 bytes | Full 68.68′ × 50.13′ publisher footprint; strongest selected optical filament detail. |
| [Spitzer IRAC](https://www.astropix.org/image/spitzer/ssc2007-07b1) | 3.6/4.5/5.8/8 µm | 2855² RGB8 TIFF; 24,453,299 bytes | Full 58.07′ square; central infrared dust filaments. |
| [Spitzer IRAC + MIPS](https://www.astropix.org/image/spitzer/ssc2007-07a1) | 4.5/8/24 µm | 2855² RGB8 TIFF; 24,453,299 bytes | Same footprint; warm-dust comparison. |
| [WISE](https://science.nasa.gov/photojournal/seven-sisters-get-wise/) | 3.4/4.6/12/22 µm | 4007 × 3061 RGB8 TIFF; 36,796,505 bytes | Approximately 3.05° × 2.33°; wider infrared cloud context. |
| [2MASS color HiPS](https://alasky.cds.unistra.fr/2MASS/Color/properties) | J/H/Ks: 1.235/1.662/2.159 µm | 4096² RGBA8 PNG; 36,023,408 bytes | 3.6° square survey reprojection; stellar near-IR context. |
| [IRAS/IRIS color HiPS](https://alasky.cds.unistra.fr/IRISColor/properties) | 25/60/100 µm | 1024² RGBA8 PNG; 777,295 bytes | 4° square survey reprojection; coarse far-IR cloud/cirrus context. |

The first four are unchanged publisher display products. The last two are
unchanged CDS hips2fits responses from explicitly requested sky grids; they are
**resampled survey displays**, not native detector images. None of the six RGB
rasters is calibrated surface brightness. Separate-band scientific arrays and
masks remain a later acquisition step.

Credits: NOIRLab/NSF/AURA/T.A. Rector (University of Alaska Anchorage), R. Cool
(University of Arizona) and WIYN; Spitzer NASA/JPL-Caltech/J. Stauffer
(SSC-Caltech); WISE NASA/JPL-Caltech/UCLA. 2MASS is a joint project of the
University of Massachusetts and IPAC/Caltech, funded by NASA and NSF. IRIS is the
IRAS reprocessing by M.-A. Miville-Deschênes and G. Lagache, served by IRSA.
Color HiPS and extraction credit CDS/CNRS/Unistra; its ODbL-1.0 terms and the
original providers' attribution policies are linked in the recipe/dossier.

## Evidence

- All six downloads decode at the recorded dimensions and were visually
  inspected on 2026-09-13. Working hashes identify unchanged downloaded bytes.
- NOIRLab's TIFF contains TAN AVM with a noncentral reference pixel and north
  approximately right. Its 9700 × 7080, 191 MB master is linked and has a
  publisher-published hash; it was not downloaded under the initial size cap.
- Both NASA Spitzer TIFFs have exactly the same 24,453,075 decoded RGB bytes as
  the corresponding AVM-bearing Spitzer masters. The
  [identity evidence](registration-evidence.json) pins both originals and proves
  that their WCS transfers without altering the source raster.
- WISE retains its publisher **SIN**, rather than TAN, projection and 180°
  rotation. Survey cutouts retain their explicitly requested ICRS TAN grid.
- The selected processing recipe re-passed held-out relative-star checks:
  IRAC 988 held-out stars / 0.458″ RMS, IRAC+MIPS 883 / 0.524″ and WISE
  111 / 1.151″. Each covers all four quadrants of its overlap with optical.
  The NOIRLab anchor is corroborated by these relative matches; absolute
  catalogue astrometry remains unverified outside publisher metadata.

## Known problems

Bright stellar halos, spikes and saturated cores remain after NOX. Spitzer covers only the
central region. The 2MASS display has weak dust contrast and visible survey seams;
its color processing also modifies green pixels. IRIS is a coarse context image
with a visibly clipped central display: its 14.06″ output pixels do not improve
its approximately 4′ beam. Do not derive a temperature, density or fine filament
position from that PNG.

Real diffuse UV observations exist at 165 and 220 nm in the WISP papers below,
but a qualified untouched raster, astrometry and reuse record were not acquired.
No UV candidate has been invented from a figure or a stellar catalogue.

## Scientific literature

The [physical evidence ledger](physical-evidence.json) distinguishes observations,
published models and authored settings. The [full-text source receipt](physical-sources.json)
pins six downloaded PDFs and the bounded search of our 3,719-reference M45 paper
catalogue. Relevant sections were read; this is not an exhaustive literature review.
No original calibrated physical array or spectral cube has been ingested.

| Primary paper | Access inspected | Appropriate later use |
| --- | --- | --- |
| [Gibson & Nordsieck 2003 I](https://doi.org/10.1086/374589) | Author-hosted full-resolution color preprint | UV/optical/FIR photometry, stellar-PSF limitations and foreground-scattering evidence; original arrays still needed. |
| [Gibson & Nordsieck 2003 II](https://doi.org/10.1086/374590) | Author preprint, Table 3 and conclusions | Conditional multilayer scattering geometry and grain parameters; not a measured density cube or universal depth prescription. |
| [Gibson 2007](https://arxiv.org/abs/astro-ph/0703055v1) | Full arXiv preprint | Projected multiscale structure and optical/H I comparison; a power spectrum cannot recover depth. |
| [Melis et al. 2014](https://doi.org/10.1126/science.1256101) | Full arXiv paper and supplements | Independent stellar distance scale, 136.2 ± 1.2 pc; not the distance of each dust filament. |
| [Miville-Deschênes & Lagache 2005](https://doi.org/10.1086/427938) | Full arXiv preprint, Table 1 | IRIS calibration, beam and sampling characterization; physical analysis requires the original calibrated bands. |
| [Ritchey et al. 2006](https://doi.org/10.1086/506585) | Full arXiv paper; §§2, 4.1, 4.3, 6; Tables 1, 6, 7 | Twenty January 2002 absorption sightlines, 1.7 km/s resolution, distinct molecular components around +7/+9.5 km/s LSR; conditional diffuse-gas density near 50 cm⁻³. No velocity-to-depth mapping. |

Author preprints for the two 2003 papers are linked in the dossier; direct
publisher/ADS downloads failed, and the author site currently serves them over
HTTP. Full text was inspected locally. No copyrighted paper or large raster is
committed here.

## Supported geometry and physical limits

The [depth recipe](depth-model.json) pins the ledger and one finite, smoothly
warped display-emission layer. A central west/east tilt follows the *qualitative*
ordering in Gibson & Nordsieck II; a local deformation is anchored at the
HD23512 molecular-cloud sightline in Ritchey et al. Every offset, radius,
curvature, thickness and blend strength is authored. J2000 paper directions are
used as coarse local anchors in the registered ICRS frame, without a proper-motion
fit. They are not new absolute-registration evidence or measured cloud boundaries.

The broad background has no physical depth constraints. The arbitrary z origin
is not the stellar plane. Neither the published 0.7 pc foreground-layer scale nor
the 136.2 ± 1.2 pc stellar distance is converted into display depth. The supported
single surface cannot reproduce the paper's overlapping dust layers, illuminated
clouds, absorption or scattering phase function. All four wavelengths paint the
same geometry and alpha; compact lights share positions and conditional depths.
This is relative display emission, never calibrated dust/gas density.

The small-scale power spectrum motivates retaining multiscale projected structure,
but supplies no 3D topology. At large scales, stellar illumination biases the
optical structure; IRIS cannot recover those fine scales through upsampling.
The absorption density estimate also depends on a molecular fraction of 0.07
and steady-state chemistry that omits time-dependent CH+ formation. It is kept
as a physical diagnostic for a future compatible forward model, not a volume prior.

## Native preparation · 13 September 2026

All four native outputs were decoded and checked; [compact evidence](processing-evidence.json)
pins their native artifacts, registration results and exact accounting. Every RGB code satisfies
`original = diffuse + residual`, with zero maximum error, complete tile coverage
and no changed pixels outside the removal mask. The original dimensions remain
4000×2920, 2855×2855, 2855×2855 and 4007×3061. Removed relative RGB light is
3.61%, 2.59%, 1.75% and 9.15% respectively; these are display totals, not stellar flux.
Structure extraction reused those completed native results with zero additional
NOX runs; its additive reconstruction error is below 3×10⁻⁸.

Visual separation remains imperfect. Seven optical cores survive with substantial
white area. The largest is centered near native (2032,541), with a 165×205-pixel
region above code 235 in all channels; other bright cores span about 100–124 pixels.
Extended halos and diffraction spikes are larger. Spitzer/WISE also retain some
bright-star light. Native diffuse products preserve real fine reflection filaments,
so deleting these broad neighborhoods would delete observed nebulosity. No masks,
exposure changes or inferred dust shapes have been used to conceal this defect.

Local receipts and original/diffuse/residual products are under
`.local/nebula-lab/observations/m45-processing/`; the six-source intake remains
under `m45/`. The ignored `output/m45-research/` holds downloaded full texts,
native accounting diagnostics and iteration logs. These are local research
artifacts, with no production promotion or hosting.

## Compiled comparison · 13 September 2026

Current local result: `a5c9a65dc905cf7bfea2b9b8045069fbd0b8abf5561d47fccb4c4a3e0f117ef8`.
[Compiler defaults](compiler.json) pin Detail 100%, Faint 35%, Depth 1× and
equal source weights. It contains 472 supports, 450 shared compact lights and
four RGB lenses. Native separation and structure extraction were reused;
the inspected trial's geometry/material bake took 36.8 seconds, total compile 39.0 seconds.

The earlier integration replay changed the implementation identity after shared
per-lens alpha validation was added. [Processing evidence](processing-evidence.json)
compares result `93de5ac15c401ba3b09c8a1676dd281b100e55527c6012fb6fbe404b799a7640`
with inspected result `ec423626da931fb5a62af42c4a280793b2877afdba0e5712204b4fb9af7b381d`:
all 4,105 bank resources (12,571,204 bytes), the numerical field, geometry,
alpha, stars, source panels and metrics are identical. The prior model/material
assessment therefore still applies; this replay adds no model refinement.

The shared star-detector correction later removed its premature 6,000 sharp-peak
cutoff. Result `8f36eed3d001b6c9acc6cb754640ced03366798edc374251069484c56726ccc4`
retains the 450-light budget but selects 99 newly eligible measured residual
sources. All cloud resources, geometry, alpha, source panels and metrics remain
exact. The current owner replay is also byte-equivalent in all those properties
and its stars to that result. Pleiades does not enable Lagoon's opt-in registered
star union; this final replay adds no geometry, material or stellar refinement.

| Comparison | Supports | Relative-image RMSE | Missing signal | Excess signal |
| --- | ---: | ---: | ---: | ---: |
| Detail 65% baseline | 359 | 0.028515 | 11.04% | 10.98% |
| Detail 100% retained trial | 472 | 0.024469 | 9.59% | 9.18% |

The baseline is `37c56fce3ce71f8c4058fb94ecc2d27e9059425eff118aff1685a82f511e4539`.
The target image and fitting implementation have identical hashes across these
two trials; only detail selection and its supporting recipe-default plumbing
changed. The 14.2% lower residual measures better display-image agreement,
not improved physical depth. Zero-emission baseline RMSE is 0.179623 for both.

All result/resource hashes validate. The four lenses preserve exact neutral
frame and slab geometry, and every decoded alpha byte. The recorded alpha
digest is `4531ee08d209e44ec9725f3b4ef20d0251ca79e10927e8757d552587c8b06466`.
XYZ banks use 512px in-plane sampling and four samples per slab.

Isolated Chromium inspection loaded the saved result without processing and
passed all four source switches, stable compact-light positions, star toggles,
Earth view, 59.5°/35° oblique, 90° west and 89° north views, original overlay
and refresh. No browser errors or processing POSTs occurred. Screenshots and
the current star-detector interaction receipt are local in
`output/nebula-processing/m45-stars-final-browser/`; the first
comparison remains in `output/m45-inspection-round1/`.
The latest full inspection tested result `8f36eed3d001b6c9acc6cb754640ced03366798edc374251069484c56726ccc4`;
exact cloud, stellar and source identity makes it applicable to the current replay.
The preserved `output/m45-inspection/` folder tested the earlier alpha integration. Its earlier
interaction receipt was archived from the complete pre-replay file read in
`output/nebula-processing/m45-inspected-prior-receipt.json`; the old result ID
and the reason its visual assessment remains applicable are retained in the
processing evidence.

**Visual acceptance is withheld.** Higher detail modestly sharpens the cloud,
but does not recover narrow native dust fibers. Large optical stellar glows
remain in the diffuse 3D material. The single warped layer becomes a narrow
ribbon from the side and retains fine slice/color traces. Optical and Spitzer
footprints have hard color transitions to the explicitly neutral wider cloud;
WISE is the most useful full-field lens. No missing color was invented and no
geometry was discarded to hide those boundaries.

The bounded comparison stopped after two bakes. Remaining source contamination
requires qualified saturated-PSF separation or explicit unreliable-pixel coverage,
not a large circular erase through real reflection nebulosity. Physical depth
needs a compatible scattering/illumination model and independently qualified
constraints; smooth thickness changes cannot supply those. The current output
is a reproducible experimental display volume, not a recovered dust cloud or
an accepted production-quality scene. Fresh-cache/cold-checkout replay and
quantitative bank-handoff stability were not established by this run.

Use the shared [clean-start compiler instructions](../../docs/emission-compiler.md#reproduce-from-a-clean-checkout)
with this object's compiler recipe. `compile-nebula` now honors the pinned
defaults; a warm `compile-candidates` replay verified and restored the same
result before its local lab pointer was installed. No additional star removal
ran during either volume bake or replay.

Two wider optical originals are now available in Alignment: Mohamed Usama/IAU OAE (CC BY 4.0; preliminary 7.43° × 4.93° footprint) and Rogelio Bernal Andreo (CC BY-NC-ND 3.0; preliminary 4.86° × 3.46°). They show outer dust beyond the existing 1.14° × 0.84° NOIRLab crop. Their small bright-star seeds initialize comparison only; neither passed independent faint-star registration or establishes the outer-field distortion. [The intake receipt](widefield-intake.json) pins both originals and coordinate evidence. Andreo is retained for local unchanged comparison because derivative redistribution is restricted. The four-source processing recipe and completed model are unchanged.

The full intake reuses the original four sources' completed native diffuse and residual layers through a signed processing-recipe reference. Reuse checks original bytes, native dimensions, NOX model and script signatures, and native artifact receipts, then keeps the intake's verified placement. The mixed-intake browser regression opened both layers for all four sources, left both wider candidates' removal views disabled, and issued no processing requests.
