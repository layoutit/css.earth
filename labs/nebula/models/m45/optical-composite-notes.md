# M45 optical composite evidence

Niittee supplies observed optical pixels across nearly all of the existing cloud. A prepared comparison combines its wide-field colour with NOIRLab central image detail. The image composite is complete; the retained 3D cloud remains a coarse research baseline, not an accepted dust-density reconstruction.

## Prepared comparison and limits

Result `4510c5bb3a8890c4fb6eaf9a3534b87e7079a4dbc50a1076a36bec78e251f9e7` adds **Optical composite · NOIRLab + Niittee** to the four existing Reconstruction lenses. [The recipe](optical-composite.json) pins the exact retained cloud and neutral slices; [the observation recipe](optical-composite-observations.json) owns the two registered native inputs. Large originals, separation products, image panels and volume slabs remain ignored.

Embedded source `processingVariant` descriptions retain their original intake-time purpose. The composite recipe's `intakeStatus` and generated native receipts supersede their historical Alignment-only status.

- Source preparation uses the full 4000×2920 NOIRLab and 8000×5199 Niittee rasters. NOIRLab's native NOX was reused; Niittee's native inference took 37.94 seconds across 294 tiles. Its receipt verifies complete coverage and exact original = diffuse + residual accounting. Broad stellar cores, rings and halos still survive: numerical accounting does not establish perfect separation.
- A shared 45″ Gaussian scale separates broad illumination from fine detail. Niittee supplies RGB and broad illumination. Within the NOIRLab footprint, a bounded log-luminance detail ratio replaces the wide image's fine detail; a 360″ physical edge feather returns continuously to unchanged wide-only pixels. The multiplier is limited to 0.5–2 and bounded against shared RGB clipping. Original and diffuse composites use their corresponding low-pass images.
- This is a single Gaussian/detail split, related to the frequency separation used in [Burt & Adelson's multiresolution image mosaics](https://persci.mit.edu/pub_abstracts/spline83_abs.html), not a full multilevel spline. These differently filtered and stretched photographs do not become calibrated photometry through blending.
- The new material samples that composite into finite XYZ emission components. It retains all 1,094 neutral slab geometries and every decoded alpha byte, the field, the four old lenses and the same 450 catalogue stars. Only the new optical RGB bank and its Original/Without-stars panels are added.
- **The current component material keeps one averaged chromaticity per emitter. It discards scalar luminance detail during normalization.** Consequently the image panel contains NOIRLab fine detail that this 3D bank cannot retain; the 3D colours are essentially the wider image's colours. No photographic extrusion is used to conceal that limit. Future fine-detail work must change the finite spatial/material representation.

Three bounded image trials were inspected. Global affine RGB matching reduced overlap RMSE from 59.98 to 27.15 display code values but crushed faint outer dust. Confining that correction to the overlap preserved the outskirts but left a dark rectangular centre. Both were rejected. The Gaussian/detail composite removes that broad rectangular join and preserves the surrounding display colours. Its fine stellar artifacts are still visible.

Front, oblique, west-side and north-side browser inspection confirms that the coarse cloud still loses filaments, contains stellar halos, and becomes a thin bright ribbon edge-on. **Full visual acceptance remains withheld.** This is an additional local comparison lens, with no production promotion. Source switches, Original overlay, pose retention and refresh work without processing requests or browser errors; 38 affected tests and strict lab TypeScript checking pass. The fractional-RGB boundary regression fails before the numerical clipping fix.

## Repeating this experiment

The offline `prepare-optical-composite` lab command accepts the composite recipe; `--preview-only` stops after preparing its image panels. It writes a staged result and publication receipt and does not change the running lab's selected result. `browser-optical-composite` exercises that staged receipt in an isolated browser before any local selection is changed.

This experiment explicitly depends on the pinned existing cloud snapshot and its retained assets. It is **not yet a cold-checkout full-compiler recipe**: a normal Compile nebula or geometry-slider rebuild recreates the original four-source result without the additional material. Reapply this command to the pinned baseline for comparison; do not edit immutable result hashes or claim the additional lens survives a new geometry fit. The next integration step is a declared composite material source in the shared compiler recipe.

Native Niittee receipt SHA-256: `9f40eab8196e654f6c0755c00d45cc576bbbcfe98940b0719220725d3a7007e7`; diffuse: `4eab860475b796906bb76bf884ad7c08181a29deab8132209f29ed0511c9efa4`; residual: `b38fd3aa48203ef15ef2462b88977c67b358fe28f183840e254bc1ea9d79e405`. The generated result method records both sources, all native byte pins, material assumptions and historical baseline identity. Local inspection images and receipts are under `output/m45-composite/browser-detail/`.

## Coverage measured on 2026-09-13

Measured against the current published cloud `29c367b2…`, retaining cloud model `166244f6…` from `a5c9a65d…`. Integrate each finite component analytically through Z, then use midpoint quadrature over the entire model XY support. Test native pixel-edge footprints using the saved affine transforms, without cropping the model or thresholding image brightness.

| Source | Full model projected emission covered | Existing target signal covered |
| --- | ---: | ---: |
| NOIRLab optical | 60.1375% | approximately 59.9828% |
| Niittee optical | 99.8366% | approximately 99.9995% |
| NOIRLab + Niittee union | 99.8366% | same as Niittee; centre lies inside it |
| Usama optical, provisional placement | 100% | approximately 100% |
| Andreo optical, provisional placement | 99.9938% | approximately 100% |

The full-model Niittee result changes by less than 0.00007 percentage points between 512-wide and 1024-wide grids. The target estimate inverts its known `1 − exp(−emission)` PNG encoding and retains 8-bit quantization uncertainty. It is separate from the unquantized analytic model result. The model contains infrared-supported display emission; footprint coverage does not establish optical dust membership. The 0.1634% uncovered model contribution must stay explicitly uncovered, without extending colors beyond the image. These measurements do not establish coverage of all Pleiades-associated or unrelated cirrus beyond this cloud.

Full model west/north bounds: X −5521.30 to 7593.88 arcsec; Y −6789.59 to 7695.88 arcsec. Niittee's rotated raw footprint corners, in the same west/north frame, are (−8484.37, 3048.21), (6973.15, 6737.77), (9385.46, −3298.79), and (−6072.05, −6988.35) arcsec. NOIRLab's raw bounding box is X −977.57 to 2085.78; Y −2138.60 to 2022.29 arcsec. Rectangular bounding boxes alone were not used to calculate coverage.

The reproducible local diagnostic and complete input pins are in ignored `output/m45-composite/coverage.ts` and `coverage.json`.

## Usable source and registration

- [Niittee's original author record](https://commons.wikimedia.org/wiki/File:Plejades.jpg): Taavi Niittee / Tõrva Astronomy Club, CC BY 4.0. The local original is `.local/nebula-lab/intake/m45/widefield/niittee-pleiades.jpg`, SHA-256 `96c04d4db1cd317544bd616fe41ce337f32aa1dac2fcd69702419f29c426e5aa`. The registered-source copy `.local/nebula-lab/observations/m45/sources/niittee-widefield.tif` has the exact same bytes: it contains JPEG data despite its extension. Both files were decoded and hashed during this check.
- Published raster: 8000 × 5199 RGB8, without alpha. The full image was visually inspected and has observed field content to the edges. The camera sensor is smaller than the published raster; 8K output is not independent detector resolution. The nominal field is 264.79′ × 172.08′. This is broadband optical display color, with the stated L-Pro filter, not calibrated flux.
- Saved registration: 295 matched stars, 99 held out, four common-field quadrants, 0.450″ held-out RMS. Absolute astrometry inherits the [NOIRLab reference](https://noirlab.edu/public/images/noao-m45/). The outer Niittee footprint has not been independently checked for lens distortion; the passing residual applies to the central overlap.
- Composition should retain NOIRLab detail in that overlap, estimate brightness/color matching using the shared diffuse optical pixels, and use Niittee's actual surrounding pixels. Matching different processed displays does not establish photometric calibration.

## Wider acquired alternatives

[Usama / IAU OAE](https://iauarchive.eso.org/public/images/detail/ann22042ab/) is already present at `.local/nebula-lab/intake/m45/widefield/iau-usama.tif`: 3365 × 2234, nominal 445.85′ × 295.99′, CC BY 4.0. Its provisional bright-star seed covers the whole model, but the required independent registration failed with zero matches, including the prior Niittee bridge attempt. Before use, it needs a successful full-field stellar registration against an appropriate astrometric catalogue or a registered optical reference, with held-out stars spanning its wider image. The current central seed cannot qualify its outer geometry. Its larger field is not needed to close a material coverage gap in the present cloud.

[Andreo / APOD](https://apod.nasa.gov/apod/ap091014.html) is also acquired at `.local/nebula-lab/intake/m45/widefield/andreo-pleiades.jpg` (2200 × 1567), but has the same failed independent registration and the recorded CC BY-NC-ND terms. It remains a comparison source.
