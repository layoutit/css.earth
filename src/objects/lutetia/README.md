# Lutetia

Lutetia is shown as the released Rosetta shape model, with three OSIRIS close-up photographs draped over part of it, an elevation view and IAU feature names. Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View or property | Source and interpretation |
| --- | --- |
| OSIRIS reflectance | Three NAC orange-filter close-ups from 10 July 2010, 15:41:06.632–15:43:00.199 UTC, at approximately 88, 78 and 68 m per pixel. [ESA's original STR-REFL products](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/OSINAC/RO-A-OSINAC-4-AST2-LUTETIA-STR-REFL-V1.0/DATA/IMG/) supply resampled I/F with separate sigma, quality and camera records. |
| Shape and Elevation | [PDS Rosetta Lutetia shape release](https://pdssbn.astro.umd.edu/holdings/ro-a-osinac_osiwac-5-lutetia-shape-v1.0/dataset.shtml), DOI [10.26007/aajh-r451](https://doi.org/10.26007/aajh-r451), `lutetia_025k_cart.wrl`, by Laurent Jorda, Robert Gaskell, Mikko Kaasalainen and Benoît Carry; Tony Farnham edited the PDS archive. Elevation is radius minus 49 km, false color from −16 to +16 km, not gravitational height. |
| Photometry | The Hapke (1993) model that [Hasselmann et al. (2016)](https://doi.org/10.1016/j.icarus.2015.11.023) fitted to NAC images of the Baetica and Etruria regions, transcribed in [the model record](source/photometry/hasselmann-2016-hapke-1993.json). |
| Spin | Table 1 of the pinned Jorda–Vincent rotation document: J2000 pole RA 51.80°, Dec +10.83°, W = 289.50° + 1057.751519° × (JD − 2451545.0), period 8.168270 ±0.000001 h. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/LUTETIA/target) Lutetia centre-point export, snapshot 2026-09-11, public domain. Labels appear at the closest zoom only, and a selected feature stays labelled. |
| Feature notes | 2 names carry the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), pinned in `source/features/notes.json`; the caption credits Wikipedia. |

The pinned Horizons physical block supplies the 49 km reference radius and GM 0.1134 km³/s².

## Processing

The shared `vrml-mesh` reader reads the original mesh, and meshoptimizer 1.2.0 simplifies it from 24,526 faces to 800, with an authored 1,200 m allowance. Every displayed face is a PolyCSS raster triangle with a 128 px cell.

Each photograph gets a camera from its original kernels. Preparation then registers it to the shape by image/model correlation, fitting a translation on two relief windows and checking two held-out windows against a 12-pixel limit. Photometry carries each pixel to 35° incidence, 0° emission and 35° phase. Incidence and emission are limited to 70°, phase to 25–55°, and gain to 0.4–2.5; pixels outside these limits are withheld. Lowest emission selects the source where photographs overlap.

Reproduce a camera with `python packages/bake/cli/prepare-archived-camera.py src/objects/lutetia/source` after `node packages/bake/cli/restore-source-inputs.mts --object=lutetia`, then run `node site/build/prepare/prepare-authored.ts lutetia --write`. Nothing is fitted or corrected in the application.

## Evidence

- Photographic coverage is 29.66% of the surface on 64 area-weighted samples per triangle.
- The cameras reproduce the archived boresight within 0.00000368° and the surface-intercept point within 0.01069 pixels.
- The third photograph needed a translation of [−36, +183.5] pixels; its withheld residual is 8.14 pixels and all four correlations exceed 0.70.
- Overlap display gains are 1, 0.9851 and 0.9688.
- The simplified mesh deviates from the source by 255.658 m mean and 1453.051 m maximum over 8,192 directions.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `osiris` | 3 | 0 | — | — | — | its other 3 frames | 0 of 3 | — | 3 of 3, 0.00° | — | ×1.00 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The shape joins detailed northern OSIRIS reconstruction to coarser lightcurve and outline modeling; the published join discontinuity and local defects remain. The unvisited side is not an equally detailed Rosetta reconstruction.
- Photographic coverage is partial and gaps remain a grid.
- Registration fits the photographs to the selected shape, not to independent ground truth. No roll, scale or local warp is fitted.
- `N20100710T154047674ID4DF22` records skipped in-field and out-of-field stray-light correction despite its STR-REFL collection name.
- The Hapke model is a regional fit applied to the whole view. It does not recover global albedo or cast shadows.
- The 15:43:54 candidate failed image/model registration and the 15:45:28 candidate failed the archived-intercept check; neither is included.
- Nomenclature outlines are not published boundaries.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
