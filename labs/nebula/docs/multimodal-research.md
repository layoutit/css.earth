# Multimodal nebula reconstruction: evidence and next experiments

Primary-source search checked 2026-09-12, against lab baseline
`36ba61b89f62e1eca7a30af0fc04185131b6b728`. These are research recommendations,
not a passed reconstruction or visual-quality result.

**Use the registered images to discover projected structure, then test a small
family of emission/velocity models.** Additional wavelengths expose different
material along the same sightline; they do not supply stereo views. The current
ESO composites support morphology, not calibrated line ratios or gas density.
[WFI uses B/V/R](https://www.eso.org/public/images/eso0907a/);
[VISTA uses Y/J/K](https://www.eso.org/public/images/eso1205a/).

[O'Dell et al. 2004 §3.1](https://arxiv.org/html/astro-ph/0407556v1)
interpret the bright main structure as an inner disk plus a differently tilted
outer ring, using ionization stratification and published velocities as well
as ellipse appearance. Their central He II emission also makes a crucial
distinction: a weak center in common optical composites is not evidence of an
empty cavity. Treat this geometry and the Meaburn bipolar interpretations as
candidate families to compare, not extra measured depth samples.

## Image evidence beyond ellipses

| Method / checked primary source | Practical contribution | Limit and priority |
| --- | --- | --- |
| [Men’shchikov et al. 2012, getsources](https://arxiv.org/abs/1204.4508) | Combine normalized detection evidence across scales/wavelengths; measure each original band separately. | Best immediate model for fusion. A combined detection score is not physical intensity. |
| [Men’shchikov 2013, getfilaments](https://arxiv.org/abs/1309.2170); [2021, getsf](https://arxiv.org/abs/2102.11565) | Separate compact sources, elongated structures and diffuse backgrounds before combining detections. | Preserve band-specific detail and unassigned signal. The [existing local getsf experiment](research/getsf.md) timed out before component outputs; do not describe it as a passed benchmark or repeat that expensive run by default. |
| [Steger, 1996 primary technical report](https://mv.in.tum.de/_media/members/steger/publications/1996/fgbv-96-03-steger.pdf), published in PAMI 1998 | Derivative-based subpixel line positions, widths and linked junctions; models lateral contrast asymmetry that can shift a detected ridge. | Useful refinement of the current ridge maps before fitting geometry. Check line-profile assumptions against stretched composite images. |
| [Freeman & Adelson 1991, steerable filters](https://people.csail.mit.edu/billf/steerpaper.html) | Synthesize arbitrary oriented filter responses from a small basis instead of evaluating many separate rotations. | Practical offline orientation/tail analysis; filter agreement remains projected evidence. |
| [Koch & Rosolowsky 2015, FilFinder](https://arxiv.org/abs/1507.02289) | Adaptive thresholds, medial-axis skeletons and graph pruning yield connected filaments and local width/orientation. | Good next increment after ridge maps. Crossings can superpose unrelated material; a skeleton is projected topology. |
| [Sousbie 2011, DisPerSE](https://arxiv.org/abs/1009.4015) | Persistence of critical points and connecting structures offers principled noise pruning. | Larger implementation cost; defer unless simpler scale persistence and graph pruning fail. Cosmological significance calibration is not automatically valid for stretched RGB. |

Recommended independent TypeScript experiment:

1. Reuse approved sky transforms and full-footprint coverage; retain each native source and its star-removal residual.
2. Compute scale-normalized ridge/compact responses in each band. Compare only scales that a band resolves; broad/soft images must not manufacture fine detail.
3. Combine a **union** detection map with a separate band-agreement map. Preserve per-band attribution, coverage, tangent and scale. A feature visible only in infrared remains eligible. Weights are declared engineering choices, not probabilities.
4. Trace ridge maxima into polylines; split branches at crossings and retain local thickness estimates. Keep compact knots and diffuse halo in separate evidence layers. A contour around a bright ridge is not a second shell.
5. Compare each output against the originals and star-removal residuals. Test whether small registration shifts, tone changes or excluding one band destroy a proposed connection. Background subtraction must not silently remove the halo.

For example, `union = max(weight[b] * response[b])` preserves a supported
single-band feature. A distinct agreement statistic can count eligible bands
above a fixed threshold and compare their unoriented tangents using
`abs(dot(tangentA, tangentB))`. Neither statistic establishes depth or membership.

## Spectroscopy: what is actually available

| Source | Access checked | What it can constrain |
| --- | --- | --- |
| [Meaburn et al. 2005](https://arxiv.org/abs/astro-ph/0504295), [2008](https://academic.oup.com/mnras/article/384/2/497/1024027) | Papers and measured PV diagrams. No original Helix slit FITS downloaded. | Sparse, spatially located line velocities. Digitized centroids remain digitized measurements with finite sampling/plot uncertainty. They do not form a filled PPV cube. |
| [SPM catalogue, López et al. 2012 §2](https://arxiv.org/html/1110.4698v1) | Public downloads described as spectral PDFs; calibrated FITS require contacting the catalogue. Listed hosts timed out or failed DNS during this check. | Strong original-slit-data lead, but **not verified direct FITS access**. No email was sent. |
| [Zeigler et al. 2013, VizieR J/ApJ/778/16](https://vizier.cfa.harvard.edu/viz-bin/VizieR-3?-source=J/ApJ/778/16) | Official machine-readable table metadata checked: 327 rows, angular offsets, intensity, FWHM, VLSR and upper-limit flags. Full table not downloaded. | Published HCO+ line parameters offer a coarse molecular-velocity follow-up. They are not channel spectra or a PPV cube. Preserve missing values/limits; verify offset origin and uncertainty before ingestion. Column density/abundance columns are separate inferred quantities. |
| [ALMA C1, Andriantsaralaza et al. 2020 §2](https://academic.oup.com/mnras/article/491/1/758/5610231) | Live archive metadata, download manifest, README and complete CO FITS downloaded and decoded. | Genuine measured position-position-frequency emission of **one knot**. Fine velocity structure; no whole-nebula coverage. |
| [SDSS-V LVM Helix, Sánchez et al. 2026 §§2,4.1,10](https://arxiv.org/html/2602.10072v1) | Original RSS and derived DAP download endpoints return HTTP 200; large files were not downloaded. | Broad main-nebula sampling with 35.5″ fibers and gaps; R≈4000. Useful line-centroid/ionization constraints, not automatically separated front/back components. |
| [Matsuura et al. 2007, SINFONI §2](https://arxiv.org/html/0709.3065v1) | Paper checked; initial ESO processed-cube query found no product. | One knot at high angular resolution, R=4490/5090. Good excitation/morphology lead; its approximately 60 km/s instrumental resolution is poorly matched to fine knot velocity splitting. |
| [MAST Helix imaging products](https://archive.stsci.edu/hst/helix/data.html) | Direct F502N/F658N imaging FITS links listed, with uncleaned mosaics and masks. | Calibrated narrowband image evidence, **not velocity cubes**. Cosmetic cleaning removed some faint knots; preserve the masks or use uncleaned products. |

Meaburn 2008 §2 corrects **2005 figures 3–5** by −26.1 km/s because their
heliocentric correction was missing. The notice does not name figure 9.
The inner-ring measured peaks −36.7±1 and −11.2±1 km/s must remain distinct
from the **deprojected** 21.2 km/s expansion derived using an assumed 37° tilt.

### Verified ALMA product

- Project `2012.1.00116.S`; member `uid://A002/X609170/X14`; observed 2014-07-21 onward.
- [CO primary-beam-corrected FITS](https://almascience.eso.org/dataPortal/member.uid___A002_X609170_X14.CO_21_SPW0.pbcor.fits): 158,803,200 bytes; SHA-256 `f8893e1489d8da2c73079c5744610aa68bc964bc8c3a491dd7025ecd0bd998fa`.
- Actual delivered header: float32, 630×630×100×1, 0.09″ sky pixels, 0.519″×0.411″ beam, Jy/beam. Frequency starts at 230,553,432,516 Hz with 121,985.1999817 Hz channel step; rest frequency 230,538,000,000 Hz. Frame `LSRK`, radio convention (`VELREF=257`). This gives approximately **0.1586 km/s per channel**.
- The paper’s separately reduced approximately 0.05 km/s sampling and 0.39″ resolution do **not** describe these delivered bytes. The 56.7″ raster extent also does not equal uniform sensitivity: the primary beam is roughly 28″.
- [Archive README](https://almascience.eso.org/dataPortal/member.uid___A002_X609170_X14.README.txt) records pipeline calibration/manual imaging, noisy high-resolution bandpass solutions and a single channel mask; only selected spectral portions were imaged. Matching uncorrected `.image.fits` and `.flux.fits.gz` primary-beam products are listed in the archive manifest.
- Header identity, full length and finite nonzero signal were checked. This verifies the input, not scientific fitting quality. Local original and detailed receipts remain under ignored `.local/nebula-lab/research/alma-helix-c1-*`.

### Broad-field LVM follow-up

The paper identifies exposure `4297`, MJD `60191`, DRP `1.1.1`:
[original row-stacked spectra](https://dr19.sdss.org/sas/dr19/spectro/lvm/redux/1.1.1/0011XX/11111/60191/lvmSFrame-00004297.fits),
[derived line-fit tables](https://ifs.astroscu.unam.mx/LVM_DR19_Helix/Helix_DR19_new.dap.fits.gz),
[corrected flux tables](https://ifs.astroscu.unam.mx/LVM_DR19_Helix/Helix_DR19_cor.fits.gz).
Its §4.5 velocity map is explicitly **not heliocentrically corrected**.
Reconcile frame, line choice and overlapping components before comparing it
with the old slits. The [current DR20 documentation](https://sdss.org/dr20/software/pipelines/lvm-dap/)
describes newer reduction/analysis versions, uncertainties and fit-quality
tables; do not silently mix them with this paper’s DR19 products.

## Reconstruction roadmap

1. **Implemented: image evidence, connected ridge skeletons and a coarse joint fit.** The [joint-fit method](joint-fit.md) records the audited Zeigler table, shell/lobe alternatives, whole-pointing velocity holdout and prepared neutral XYZ volumes. The ionized core slit remains separate. Single-component surfaces still fail substantial observed structure; none is accepted as a recovered Helix.
2. **Next: coherent components or a constrained swept wall.** Keep the same source registration and withheld velocities while improving the representation of supported arcs. [SHAPE](https://arxiv.org/html/1003.2012v1) supplies the forward-modelling pattern: construct a hypothesis, simulate the instrument observations, compare, then optimize a bounded parameter subset. Our current five-ray centroid approximation is not yet that full spectral synthesis.
3. **Then: broaden tracer-specific spectroscopy.** LVM's ionized centroids and C1's resolved channels belong to separate experiments; coverage, tracer and velocity resolution differ. Full original optical slit FITS remain valuable for component-resolved constraints. The current HCO+ table supplies no centroid uncertainties; do not substitute fitted line width for them.
4. **Finally: calibrated likelihoods and uncertainty ensembles.** Our bounded grid retains two alternatives, not a posterior. [RHOCUBE’s Bayesian shell study](https://arxiv.org/html/1611.05259v2) demonstrates parameter uncertainties and multiple fitting density families, on a different object with calibrated radio data; it does not license physical density inference from Helix RGB.

Use `P(x,y,v) = integral emissivity(x,y,z) * lineProfile(v-vz(x,y,z)) dz`,
with the actual slit/fiber footprint and instrumental response, as the forward
comparison. Under an explicit homologous model, `vz = vsys + H*z`, so
`z = (v-vsys)/H`; uncertainties in systemic velocity, H and line assignment
must survive into the depth ensemble. This is conditional geometry.

The [Wenger baseline](planetary-nebulae.md) remains useful for constrained
emission regularization, not new observations: virtual symmetry views do not
add evidence, and the 2013 paper explicitly shows a failed near-axis M57 case.
[Hb 5/K 3-17](https://arxiv.org/abs/1203.3394) demonstrates nonhomologous flow,
while [NGC 2818](https://arxiv.org/abs/2405.00169) combines echelle slits and
Fabry–Perot cubes with filament/knot components. Their lesson is to test
velocity and geometry together, not assume every projected arc is a torus.

Allow the ionized core, molecular wall, knots and halo to have distinct
emissivities and velocity laws. A held-out molecular or optical measurement
must test the corresponding tracer and footprint, rather than assume that
different emission phases occupy the same surface.

Do not normalize each image ray to guarantee the source projection and call
that validation. Hold out real slit/fiber samples or spatial supports; inspect
residuals, alternate geometry and parameter sensitivity. Inferred emissivity
is not measured physical density. Bake all XYZ banks offline only after that
model comparison; runtime remains a retained prepared-asset viewer.

## Research-run status

The headed remote run **completed at 10:49:44 UTC**, within its 45-minute bound:
52,191 report characters and six literal URLs were copied back and inspected.
An initial check failed on the absent default display; updated runner guidance
enabled the successful isolated-profile run on `:99`. Existing profiles and
cookies were preserved.

The complete raw text is in ignored
`.local/nebula-lab/research/helix-multimodal-2026-09-12.md`.
**Interactive citation anchors were not captured**: the HTML sidecar is empty
and numbered citations in the raw text are unresolved. Only independently
checked sources appear in this maintained note. Final checks promoted the
Steger/Freeman method leads and found the public Zeigler line-parameter table
that the report omitted. No additional datasets were downloaded.

Report code/examples naming separate `WFI_B` or `VISTA_Y` inputs are proposed
schemas, not evidence that calibrated filter planes were recovered. The current
lab owns registered outreach composites. Rank normalization can be tested for
stretch sensitivity, but does not make derivative-based feature scores fully
invariant to arbitrary display processing.
