# Pleiades (M45): image and science intake

Six image candidates are pinned for the local Nebula Lab Alignment tab. This is
original-image inspection only. No star removal, reconstruction, physical
constraints, volume, or production object has been prepared by this intake.

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
- These checks establish source identity and initial registration metadata.
  They do not constitute held-out star validation or a recovered 3D model.
  Independent registration results belong to the preparation receipt.

## Known problems

Bright stellar halos, spikes and saturated cores remain. Spitzer covers only the
central region. The 2MASS display has weak dust contrast and visible survey seams;
its color processing also modifies green pixels. IRIS is a coarse context image
with a visibly clipped central display: its 14.06″ output pixels do not improve
its approximately 4′ beam. Do not derive a temperature, density or fine filament
position from that PNG.

Real diffuse UV observations exist at 165 and 220 nm in the WISP papers below,
but a qualified untouched raster, astrometry and reuse record were not acquired.
No UV candidate has been invented from a figure or a stellar catalogue.

## Scientific literature

These are research intake records. Their findings have **not** been implemented
as numerical constraints or authored geometry. Detailed access status, useful
scope and exclusions are in the dossier.

| Primary paper | Access inspected | Appropriate later use |
| --- | --- | --- |
| [Gibson & Nordsieck 2003 I](https://doi.org/10.1086/374589) | Author-hosted full-resolution color preprint | UV/optical/FIR photometry, stellar-PSF limitations and foreground-scattering evidence; original arrays still needed. |
| [Gibson & Nordsieck 2003 II](https://doi.org/10.1086/374590) | Author preprint, Table 3 and conclusions | Conditional multilayer scattering geometry and grain parameters; not a measured density cube or universal depth prescription. |
| [Gibson 2007](https://arxiv.org/abs/astro-ph/0703055v1) | Full arXiv preprint | Projected multiscale structure and optical/H I comparison; a power spectrum cannot recover depth. |
| [Melis et al. 2014](https://doi.org/10.1126/science.1256101) | Full arXiv paper and supplements | Independent stellar distance scale, 136.2 ± 1.2 pc; not the distance of each dust filament. |
| [Miville-Deschênes & Lagache 2005](https://doi.org/10.1086/427938) | Full arXiv preprint, Table 1 | IRIS calibration, beam and sampling characterization; physical analysis requires the original calibrated bands. |

Author preprints for the two 2003 papers are linked in the dossier; direct
publisher/ADS downloads failed, and the author site currently serves them over
HTTP. Full text was inspected locally. No copyrighted paper or large raster is
committed here.
