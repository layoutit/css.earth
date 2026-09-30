# Orion · M42

This lab model studies a 3D emission reconstruction of M42, an asymmetric H II region and star-forming nebula. The [shipped object record](../../../../src/objects/m42/README.md) owns the active sources, delivery evidence and known problems.

## Sources

The model pins the official ESO **Publication TIFF 4K** variants, unchanged. They keep each master image's full footprint; star removal runs on the TIFF's own pixel grid.

| Dataset | Processing grid | Angular field | Publisher |
|---|---|---|---|
| ESO · optical | 4000 × 3106 | 59.95′ × 46.56′ | [Source](https://www.eso.org/public/images/eso1723a/) |
| ESO VISTA · infrared | 3252 × 4000 | 71.84′ × 88.35′ | [Source](https://www.eso.org/public/images/eso1006a/) |

- **ESO · optical:** i / H-alpha / r / G. Credit: ESO/G. Beccari. [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1723a.tif); [publisher master](https://cdn.eso.org/images/original/eso1723a.tif) (16877 × 13107).
- **ESO VISTA · infrared:** K / J / Z. Credit: ESO/J. Emerson/VISTA. Acknowledgment: Cambridge Astronomical Survey Unit. [Pinned TIFF](https://cdn.eso.org/images/publicationtiff/eso1006a.tif); [publisher master](https://cdn.eso.org/images/original/eso1006a.tif) (12640 × 15546).

ESO imagery is distributed under [CC BY 4.0 with the full credit retained](https://www.eso.org/public/outreach/copyright/) unless individually stated otherwise. Our registration, star removal, inference and texture baking are transformations of these images. They are independently stretched outreach RGB composites, not calibrated luminosity measurements.

## Recipes

- `observations.json` names each TIFF by URL with its dimensions, embedded publisher AVM TAN WCS, master dimensions and link, and a common north-up frame. AVM reference pixels are not necessarily centred or on the TIFF grid.
- The common frame contains all source corners with a six-percent angular margin. No frame is cropped.
- `observation-structures.json` configures the shared wavelet structure extraction.
- `compiler.json` configures the generic relative-emission compiler. No Helix recipe is reused.
- [physical-evidence.json](physical-evidence.json) separates observed quantities, published models and authored choices. [depth-model.json](depth-model.json) pins it and holds every support parameter; the compiler keeps copies of both with each result.

Images and derived outputs live in the ignored local cache; the recipes restore the pinned sources. Alignment must pass held-out field-star checks before star removal or reconstruction. See [the compiler method](../../docs/emission-compiler.md), [workflow](../../docs/workflows.md) and the [Nebula Compiler Process Guidelines](../../docs/nebula-compiler-guidelines.md).

## Interpretation

The optical image covers the main nebula and its cluster; the infrared image is wider. Neither covers the whole Orion molecular-cloud complex. The saturated core, diffraction spikes and bright stellar halos must not become inferred nebular structure.

The compiler fits projected emission on locally tilted finite supports along one curved front. The central reference uses the approximate 0.2 pc star/front separation and 0.1 pc emitting layer at 440 pc. The 100″ × 90″ blending window, curvature and interpolation are authored, and the wider curvature and southwest opening are visualization hypotheses. The separate Orion-S cloud, incomplete OIII cavity, foreground Veil, extinction and radiative transfer are not modelled. A smooth deformation must not be described as their reconstruction.

The fit is relative image emission, not mass density, and changing depth does not fit velocities. Optical and VISTA share geometry and alpha. The [structure and velocity research](physical-structure.md) records public spectroscopic maps; its velocity arrays are not yet fitted.

Compact lights are detected image features with conditional depths, not confirmed members with measured distances. Each dataset lights the same 650 reference positions with its own local background-subtracted residual aperture light and colour, as an equivalent angular disk. There is no opacity floor, whitening or normalization, and stars missing from the catalogue are not added. These are display measurements, not calibrated stellar flux.

## Results

The default result, `m42-coherent-front` (Detail 65%, Faint 35%, Depth 1×), fits 355 supports and 650 compact lights. Observer RMSE is 0.030138, with 8.05% missing and 9.86% excess relative signal against the combined display target. The XYZ bake uses 321/512/127 slabs at 512px width with four samples per slab. Star disks keep 99.70% (optical) and 99.86% (VISTA) of the measured aperture energy.

The support is still a coarse authored surface. Oblique colour bands and fine slice traces remain visible, and narrow optical coverage leaves neutral material outside its footprint. This is an experimental comparison, not production visual acceptance or a measured 3D density. Further artifact work belongs in volumetric material reconstruction and sampling, not invented evidence or per-view masks. See [the batch assessment and current failures](../inference-candidates/README.md#first-processing-result--2026-09-12).

Next: qualify physical-map coverage and uncertainty, implement a compatible forward observable, then compare several fronts and embedded structures. Keep the single-front result as a baseline. Carina is the next independent experiment; Orion's numerical recipe is not transferred to it.
