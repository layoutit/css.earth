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
