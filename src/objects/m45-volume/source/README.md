# Pleiades (M45): source evidence and 3D experiment

This file holds processing studies for the Pleiades nebula lab. The [shipped object record](../README.md) owns the active sources, delivery evidence and known problems. The experiments below do not qualify later deliveries.

The current result is an experimental display volume, not a recovered dust cloud or an accepted production-quality scene. Reconstruction has an **Optical composite · NOIRLab + Niittee** research dataset: Niittee's registered optical footprint covers 99.84% of the model's projected emission, compared with 60.14% for NOIRLab alone. See the [method, result, credits, rejected trials and replay limits](optical-composite-notes.md).

## Sources

The [observation recipe](observations.json) records dimensions, credits, source URLs, footprints and WCS. The [source dossier](source-dossier.json) adds band assignments, sampling versus resolution and limitations.

| Candidate | Bands | Acquired image | Coverage and role |
| --- | --- | --- | --- |
| [NOIRLab optical](https://noirlab.edu/public/images/noao-m45/) | B/V/I: 436/537/805 nm | 4000 × 2920 RGB8 TIFF | Full 68.68′ × 50.13′ publisher footprint; strongest optical filament detail. |
| [Spitzer IRAC](https://www.astropix.org/image/spitzer/ssc2007-07b1) | 3.6/4.5/5.8/8 µm | 2855² RGB8 TIFF | Full 58.07′ square; central infrared dust filaments. |
| [Spitzer IRAC + MIPS](https://www.astropix.org/image/spitzer/ssc2007-07a1) | 4.5/8/24 µm | 2855² RGB8 TIFF | Same footprint; warm-dust comparison. |
| [WISE](https://science.nasa.gov/photojournal/seven-sisters-get-wise/) | 3.4/4.6/12/22 µm | 4007 × 3061 RGB8 TIFF | Approximately 3.05° × 2.33°; wider infrared cloud context. |
| [2MASS color HiPS](https://alasky.cds.unistra.fr/2MASS/Color/properties) | J/H/Ks: 1.235/1.662/2.159 µm | 4096² RGBA8 PNG | 3.6° square survey reprojection; stellar near-IR context. Hidden. |
| [IRAS/IRIS color HiPS](https://alasky.cds.unistra.fr/IRISColor/properties) | 25/60/100 µm | 1024² RGBA8 PNG | 4° square survey reprojection; coarse far-IR context. Hidden. |

The first four are unchanged publisher display products. The last two are unchanged CDS hips2fits responses, resampled survey displays rather than native detector images. None of the six RGB rasters is calibrated surface brightness.

Wider optical fields are available in Alignment:

- [Taavi Niittee / Tõrva Astronomy Club](https://commons.wikimedia.org/wiki/File:Plejades.jpg), CC BY 4.0: an 8000 × 5199 RGB8 JPEG covering 4.41° × 2.87°, taken through an Optolong L-Pro filter with a display stretch. It is not calibrated broadband flux.
- Mohamed Usama/IAU OAE (CC BY 4.0; preliminary 7.43° × 4.93°) and Rogelio Bernal Andreo (CC BY-NC-ND 3.0; preliminary 4.86° × 3.46°). Andreo is kept for local unchanged comparison because derivative redistribution is restricted. [The intake receipt](widefield-intake.json) records both.

The [stellar catalogue](stellar-catalogue.json) contains 2,105 Hipparcos/Tycho-2 records. The 450 brightest in-frame entries are drawn as optical reference lights using apparent Johnson V, B−V and exact TAN sky projection. Their line-of-sight placement is illustrative; no membership or physical distance is invented. The [source receipt](stellar-sources.json) records the CDS cones.

Credits: NOIRLab/NSF/AURA/T.A. Rector (University of Alaska Anchorage), R. Cool (University of Arizona) and WIYN; Spitzer NASA/JPL-Caltech/J. Stauffer (SSC-Caltech); WISE NASA/JPL-Caltech/UCLA. 2MASS is a joint project of the University of Massachusetts and IPAC/Caltech, funded by NASA and NSF. IRIS is the IRAS reprocessing by M.-A. Miville-Deschênes and G. Lagache, served by IRSA. Color HiPS and extraction credit CDS/CNRS/Unistra; its ODbL-1.0 terms and the original providers' attribution policies are linked in the recipe/dossier.

## Evidence

- Both NASA Spitzer TIFFs have the same decoded RGB bytes as the AVM-bearing Spitzer masters, so their WCS transfers without altering the raster ([identity evidence](registration-evidence.json)).
- Held-out relative-star checks: IRAC 988 stars / 0.458″ RMS, IRAC+MIPS 883 / 0.524″, WISE 111 / 1.151″, Niittee 99 / 0.450″. Absolute astrometry inherits NOIRLab's publisher metadata; Usama and Andreo remain provisional.
- Native NOX separation satisfies `original = diffuse + residual` with zero maximum error. Removed relative RGB light is 3.61%, 2.59%, 1.75% and 9.15% for the four sources; these are display totals, not stellar flux ([processing evidence](processing-evidence.json)).
- Six catalogue stars meet their broad optical cores within 0.39–2.22 pixels; Alcyone differs by 6.22 pixels within a large saturated footprint ([stellar evidence](stellar-evidence.json)).

| Comparison | Supports | Relative-image RMSE | Missing signal | Excess signal |
| --- | ---: | ---: | ---: | ---: |
| Detail 65% baseline | 359 | 0.028515 | 11.04% | 10.98% |
| Detail 100% (current) | 472 | 0.024469 | 9.59% | 9.18% |

The lower residual measures better display-image agreement, not improved physical depth.

## Known problems

Visual acceptance is withheld. Bright stellar halos, spikes and saturated cores remain after NOX; seven optical cores survive with substantial white area, and deleting those neighbourhoods would delete real reflection filaments. The 3D material cannot keep the fine image detail, and the single warped layer becomes a narrow ribbon from the side. Optical and Spitzer footprints have hard color transitions to the neutral wider cloud; WISE is the most useful full-field dataset.

Spitzer covers only the central region. The 2MASS display has weak dust contrast and visible survey seams. IRIS is coarse, with a clipped central display: its 14.06″ output pixels do not improve its approximately 4′ beam. Do not derive a temperature, density or fine filament position from that PNG.

Real diffuse UV observations exist at 165 and 220 nm in the WISP papers below, but no qualified raster was acquired, and none is invented.

## Scientific literature

The [physical evidence ledger](physical-evidence.json) separates observations, published models and authored settings. Relevant sections were read; this is not an exhaustive literature review. No calibrated physical array or spectral cube has been ingested.

- [Gibson & Nordsieck 2003 I](https://doi.org/10.1086/374589): UV/optical/FIR photometry, stellar-PSF limitations and foreground-scattering evidence; original arrays still needed.
- [Gibson & Nordsieck 2003 II](https://doi.org/10.1086/374590): conditional multilayer scattering geometry and grain parameters; not a measured density cube.
- [Gibson 2007](https://arxiv.org/abs/astro-ph/0703055v1): projected multiscale structure; a power spectrum cannot recover depth.
- [Melis et al. 2014](https://doi.org/10.1126/science.1256101): stellar distance 136.2 ± 1.2 pc; not the distance of each dust filament.
- [Miville-Deschênes & Lagache 2005](https://doi.org/10.1086/427938): IRIS calibration, beam and sampling.
- [Ritchey et al. 2006](https://doi.org/10.1086/506585): absorption sightlines with molecular components around +7/+9.5 km/s LSR and a conditional diffuse-gas density near 50 cm⁻³. No velocity-to-depth mapping.

## Geometry limits

The [depth recipe](depth-model.json) defines one finite, smoothly warped display-emission layer. A central west/east tilt follows the qualitative ordering in Gibson & Nordsieck II; a local deformation is anchored at the HD23512 molecular-cloud sightline in Ritchey et al. Every offset, radius, curvature, thickness and blend strength is authored. The broad background has no physical depth constraints, and the z origin is not the stellar plane. All four wavelengths paint the same geometry and alpha. This is relative display emission, never calibrated dust or gas density.

## Reproduce

Use the shared [clean-start compiler instructions](../../../../labs/nebula/docs/emission-compiler.md#reproduce-from-a-clean-checkout) with this object's [compiler recipe](compiler.json) (Detail 100%, Faint 35%, Depth 1×, equal source weights). The [processing recipe](processing-observations.json) excludes 2MASS and IRIS. Local products are under `src/objects/m45-volume/.local/observations/m45-processing/`; the ignored `output/m45-research/` holds research artifacts that are not hosted.
