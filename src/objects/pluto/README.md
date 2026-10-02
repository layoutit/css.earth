# Pluto

Pluto shows New Horizons color and monochrome mosaics, a stereo elevation model and three modeled surface-ice maps, grouped under one **Surface ices** entry ([dataset groups](../../../docs/reader-text.md#dataset-groups)). It opens on the side New Horizons approached. Charon and the other moons are not mounted.

## Sources

Source selections, trials and open questions are in the [investigation ledger](investigations.json).

| View or property | Source and interpretation |
| --- | --- |
| Color | [NASA/JHUAPL/SwRI MVIC mosaic](https://science.nasa.gov/resource/pluto-global-color-map/), published 20 January 2017. Enhanced color from MVIC's blue, red and near-infrared filters, not natural color or calibrated reflectance. |
| Monochrome | [USGS LORRI/MVIC mosaic](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_mosaic_300m) (NASA/JHUAPL/SwRI/LPI), July 2017; 24,888 × 12,444, east-positive longitude. |
| Elevation | [USGS stereo DEM](https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_dem_300m): signed metres above a 1,188.3 km sphere; −32,768 means missing. Data run −4.10 to +6.49 km; false-color scale −8 to +8 km. |
| Methane, nitrogen and water ice | [Drozdov & Emelyanov (2026), Zenodo 18825240](https://zenodo.org/records/18825240), CC BY 4.0 ([paper](https://doi.org/10.1016/j.icarus.2026.117031)). Modeled surface fractions from five New Horizons LEISA scans on 14 July 2015. All three use the same 0–100% scale; they are infrared spectral fits, not photographs. |
| Opening view | The side New Horizons approached: its reverse inbound velocity in the IAU body frame at closest approach, 146.5°E, 43.2°N, computed from the [NAIF New Horizons SPICE archive](https://naif.jpl.nasa.gov/pub/naif/pds/data/nh-j_p_ss-spice-6-v1.0/nhsp_1000/) (`nh_recon_pluto_od122_v01`, `nh_plu047_od122`, `pck00011`) by [the approach recipe](source/preparation/approach.json) and checked against SpiceyPy ([`packages/bake/src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts`](../../../packages/bake/src/objects/default-view/fixtures/new-horizons-approach.oracle.test.mts)). |
| Physical facts | Pinned [JPL](https://ssd.jpl.nasa.gov/planets/phys_par.html) and [NASA](https://science.nasa.gov/dwarf-planets/pluto/facts/) records ([JPL values](source/orbit/jpl-physical.json)). The 39.482 AU semimajor axis is checked against the [archived JPL table](https://web.archive.org/web/20190803153746/https://ssd.jpl.nasa.gov/txt/p_elem_t1.txt). |
| Lighting | The lunar-Lambert law of [Buratti et al. (2017)](https://doi.org/10.1016/j.icarus.2016.11.012), A = 0.70 for LORRI; its limb limit is derived here. See [Lighting law](#lighting-law). |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/PLUTO/target) Pluto centre-point export, snapshot 2026-09-11, public domain. Available in all six views. |
| Feature notes | Lead summaries of 21 English Wikipedia articles (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata, in `source/features/notes.json`. |

## Processing

All maps use 0–360° east longitude and are painted into the shared raster lane of 450 leaves ([seam treatment](../../../docs/surface-preparation.md#reduce-geometry-and-bake-the-atlas)). The missing-coverage grid is painted before packing, so no gap is interpolated.

The DEM uses a blue/tan/red palette linear at −8/0/+8 km with northwest hillshade and no exaggeration. Color encodes height; brightness encodes relief.

**LEISA ices.** We use the authors' preferred least-squares solution, `params_ls.fits`, with `params_ls_errors.fits`: 1,067 × 534 area fractions in percent. The headers omit WCS, so the array covers the full sphere with east longitude from 0° to 360° and north up, as the paper's Figure 6 shows. We withhold uncomputed cells (335,273 carry a fixed initialization tuple) and, as a display choice, cells whose error is not between 0 and 100 percentage points. Sampling is nearest-cell.

| Ice view | Accepted native cells | Fraction of the sphere, area weighted |
| --- | ---: | ---: |
| Methane | 213,048 | 34.28% |
| Nitrogen | 210,515 | 34.04% |
| Water | 204,625 | 32.58% |

All three use one linear viridis palette; colors are a numeric scale, not surface color.

## Lighting law

The globe is lit with the Buratti et al. (2017) law, fitted to LORRI approach images at 15.08° to 16.85° phase: I/F = f(α) [A μ0/(μ0 + μ) + (1 − A) μ0] with A = 0.70 ([record](source/photometry/buratti-2017-lunar-lambert-lorri.json)). Each frame is relative to the flood-lit disc centre, so the default view's centre shows the map as published ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)).

- The paper states no emission range. The 86.8° limit is derived here: the emission angle at the outermost pixel of LOR_0299124574, the finest Pluto image in their Table 1, at 3.81 km per pixel. Beyond it the law is held.
- With the Sun behind the viewer the law darkens the limb to 0.56 of the centre.
- The paper prints no values for the phase function f(α), so the Shadows frames carry no phase term.

## Evidence

- The LEISA reader matches 192 independent Astropy/NumPy sample decisions and the accepted cell counts for all three maps ([reference values](../../../src/objects/pluto/fixtures/leisa-astropy.json)). The native maps give 69.31% methane-rich and 19.88% nitrogen-rich ice averaged over 60–90° N, matching the paper's rounded 69% and 20%. This checks decoding and masking, not the authors' spectral inversion.
- The Gazetteer map edge was fixed by drawing rims under both edge hypotheses and keeping the one where Sputnik Planitia coincides with the color mosaic.

## Known problems

- LEISA fractions depend on the assumed ice optical properties and fitting method. The paper reports residual scan seams and sensitivity of Sputnik Planitia's nitrogen fraction to the assumed nitrogen absorption. Gray means no usable fit, not zero ice. The nominal 7 km cells cannot support close-up geological detail.
- The mosaics and DEM have incomplete, uneven coverage, and a gray grid marks identified gaps. In the color JPEG only exactly-black pixels connected to the southern border are marked, so a dark boundary fringe can remain. No terrain is filled.
- One lighting law lights the whole body. The authors say it under-corrects the brightest regions and over-corrects the darkest, and it does not describe the haze-lit limb at high phase. Pluto's haze layers are not modelled.
- The camera, the 180° spin origin and the 84-second retrograde rotation are presentation choices; pole and Sun direction come from the IAU/WGCCRE model.
- Feature outlines are not published nomenclature boundaries.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
