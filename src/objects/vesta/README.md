# Vesta sources and interpretation

Vesta uses Dawn framing-camera mosaics, spectral ratios and a terrain model in the Claudia coordinate system, with GRaND element maps, gravity maps and a geologic map.

## Sources

| View or quantity | Source |
| --- | --- |
| Visible color | [DLR Dawn HAMO mosaic](https://dawngis.dlr.de/data/Vesta/mosaic_vesta.php) from 650, 550 and 430 nm bands |
| Clear-filter photography | [DLR Dawn LAMO mosaic](https://dawngis.dlr.de/data/Vesta/mosaics/LAMO/clear/Vesta_mosaic_LAMO_global.png), October 2012, 20 m/pixel source |
| HAMO photography and the north | [DLR Dawn HAMO-1-2 clear mosaic](https://dawngis.dlr.de/data/Vesta/mosaics/HAMO/clear/Vesta_mosaic_HAMO-1-2_global.png), May 2013, 60 m/pixel; HAMO-1 south (2011) joined with HAMO-2 north (June to July 2012) |
| Spectral ratios | [DLR Clementine-style mosaic](https://dawngis.dlr.de/data/Vesta/mosaics/HAMO/clementine/Vesta_clementine_HAMO-1-2_global.jp2), from the original PDS archive |
| Shape and elevation | [DLR HAMO 64-pixel-per-degree terrain model](https://dawngis.dlr.de/data/Vesta/dtm_vesta.php) |
| Hydrogen | [Dawn GRaND hydrogen map](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/data_derived/), PDS4 `GRD_HYDROGEN_MAP`; Prettyman et al. 2012, [Science 338, 242](https://doi.org/10.1126/science.1225354) |
| Iron gamma rays | [Dawn GRaND corrected iron counting rate](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/data_derived/), PDS4 `GRD_IRON_CORRECTED_COUNTS_MAP`; Yamashita et al. 2013, [MAPS 48, 2237](https://doi.org/10.1111/maps.12139) |
| Fast neutrons | [Dawn GRaND fast neutron residual map](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/data_derived/), PDS4 `GRD_FAST_NEUTRON_RESIDUAL_MAP`; Lawrence et al. 2013, [MAPS 48, 2271](https://doi.org/10.1111/maps.12187) |
| High-energy gamma rays | [Dawn GRaND high-energy gamma-ray counts](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/data_derived/), PDS4 `GRD_HEGR_COUNTS_MAP`; Peplowski et al. 2013, [MAPS 48, 2252](https://doi.org/10.1111/maps.12176) |
| Neutron absorption | [Dawn GRaND neutron absorption map](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/data_derived/), PDS4 `GRD_NEUTRON_ABSORPTION_MAP`; Prettyman et al. 2013, [MAPS 48, 2211](https://doi.org/10.1111/maps.12244) |
| Gravity | [Dawn Vesta Gravity Science Derived Data Bundle](https://doi.org/10.17189/av2q-ka20) 1.0, maps of JPL model VESTA20H (PDS3 `DAWN-A-RSS-5-VEGR-V2.0`); Konopliv et al. 2014, [Icarus 240, 103](https://doi.org/10.1016/j.icarus.2013.09.005) |
| Geology | [Yingst et al. 2023 global geologic map linework](https://doi.org/10.5281/zenodo.19475473), Zenodo, CC BY 4.0; [PSJ 4:157](https://doi.org/10.3847/PSJ/acebe9) |
| Physical placement | JPL Horizons solution #36 |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/VESTA/target) Vesta centre-point export, snapshot 2026-09-11, public domain |
| Feature notes | Lead summaries of 9 English Wikipedia articles (CC BY-SA 4.0, retrieved 2026-09-12), in `source/features/notes.json` |

## Processing

**Photographs, color and terrain.** Each DLR image is placed in Claudia coordinates by its PDS label's pixels per degree and projection offsets ([LAMO label](source/reference/lamo-clear.lbl), [ratio label](source/reference/clementine.lbl)). Exact all-channel black is treated as likely fill, and the HAMO-1-2 mosaic fills northern gaps in the natural-color and LAMO views in gray. The spectral ratios are shown unchanged: red 749/438 nm, green 749/917 nm, blue 438/749 nm. The terrain values are radii in metres, as the DLR release says. The radial model is simplified to 800 triangles with an 8 km allowance ([simplifier](https://github.com/zeux/meshoptimizer/blob/v1.2/js/README.md#simplifier)), with fixed-epoch lighting and no cast shadows.

**GRaND element maps.** Dawn's gamma-ray and neutron detector measured the top few decimetres of regolith from about 210 km up.

| Dataset | Archived quantity | Pixels | Values | Dates |
| --- | --- | --- | --- | --- |
| Hydrogen | Hydrogen abundance, µg/g | 16,200, 2° × 2° | 0.0 to 391.1 | 2011-12-08 to 2012-01-14 |
| Iron gamma rays | Fe 7.6 MeV counting rate corrected for neutron density, counts/s | 178,698 equal-area, 0.5° tall | 0.0687 to 0.07746 | 2011-12-08 to 2012-04-27 |
| Fast neutrons | Residual fast neutron counting rate, counts/s | 114 quasi-equal-area, 20° tall (10° polar caps) | 1.170 to 1.237 | 2011-12-09 to 2012-01-14 and 2012-04-03 to 2012-05-01 |
| High-energy gamma rays | Corrected high-energy gamma-ray counting rate, counts/s, with 1σ uncertainty | 210 quasi-equal-area, 15° tall (7.5° polar caps) | 12.516 to 13.143 (1σ 0.117 to 0.311) | 2011-12-12 to 2012-05-01 |
| Neutron absorption | DCP, unitless, with 1σ uncertainty | 204 quasi-equal-area, 15° tall (7.5° polar caps) | −0.0364 to 0.031 (1σ 0.0014 to 0.0075) | 2011-12-08 to 2012-01-14 |

The archive uses Claudia Double Prime, which the [GRaND catalogue](https://sbnarchive.psi.edu/pds3/dawn/grand/DWNVGRD_2/CATALOG/GRAND_VESTA_IRON_CORR_CNTS_MAP_DS.CAT) says is 210° of longitude from Claudia. [`prepare-grids.mts`](../../../packages/bake/authoring/vesta-grand/prepare-grids.mts) places every pixel by its own bounds and adds 210°, so no value is resampled. Hydrogen is richest where dark, carbonaceous material fell and poorest in Rheasilvia. Higher iron marks basaltic eucrite against Rheasilvia's diogenite. Fast neutrons follow average atomic mass ([Lawrence et al. 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC4461122/)). The catalogues' conversions to weight percent and cross section are not applied.

**Gravity.** Four datasets show JPL's maps of VESTA20H, a degree-20 fit to Dawn tracking from July 2011 to July 2012.

| Dataset | Archived product | Values | Scale |
| --- | --- | --- | --- |
| Radial gravity | `JGDWN_VES20H_ACCEL_0020`: radial gravity without J2 on a 290 × 265 km ellipsoid | −1233.6 to 2045.8 mGal | ±2000 mGal; 0.16% of the area, in Vestalia Terra |
| Uncertainty | `ACCERR_0020`: one-sigma error from the model covariance | 19.3 to 169.2 mGal | 0 to 170 |
| Bouguer anomaly | `BOU_0015`: radial gravity minus the pull of the shape at uniform density, degrees 2 to 15 | −156.4 to 238.2 mGal | ±250 mGal |
| Geoid | `GEOID_0020`: metres above an ellipsoid of a = 281.0 km, flattening 0.1957, within 60° of the equator | −9196.9 to 6912.9 m | ±9000 m; 0.26% of the shown area |

Each grid is read at Claudia longitude + 150°, so no cell is resampled. For scale, mean surface gravity is about 25,300 mGal.

**Geology.** The Yingst et al. (2023) map has 136 polygons in 18 units in the authors' own colors. `geology-grid.py` rasterizes it at 2048 x 1024 in its own coordinates ([plan](source/geology/prepare-grid.json), [units](source/geology/vesta-geologic-units.json)). Contacts and linear features are not drawn. Its atlas has every other dataset's size since 5 October 2026: stored at a quarter of it, the dataset was drawn enlarged and cost 293 to 335 ms a switch on an iPad, against 75 to 76 ms now.

**Named features.** `presentation/surface-map.json` puts the map's left edge at 150° in the Gazetteer's Claudia Double Prime frame, and each anchor sits on the shape model.

## Evidence

![Dawn LAMO photography on Vesta](evidence/lamo-desktop.png)

- North coverage: the LAMO mosaic covers 84 % of the map and nothing above 75° N; the HAMO-1-2 mosaic covers every cell, dim but showing craters above 75° N (`evidence/hamo/`).
- GRaND: with the 210° shift, the eucrite-rich band Lawrence et al. (2013) place at 90° to 225° E averages above each map's mean; without it the contrast shrinks or reverses.
- Gravity: radial gravity correlates with the terrain radius at r = 0.896 at Claudia + 150°, the best of 360 shifts. The Bouguer maximum, 238 mGal, lies in Vestalia Terra, as [Raymond et al. (2013)](https://meetingorganizer.copernicus.org/EGU2013/EGU2013-12408.pdf) describe.
- Geology: crater-floor units average 1,120 m below a high-pass of the terrain at this placement, against -146 to +217 m at every other 10-degree offset.
- Named features: with the shift, all 33 Gazetteer craters 15–80 km across within 40° of the equator have centres below the ring one diameter out; without it, 11 do (`evidence/gazetteer-frame/crater-depressions.json`).
- Thirty VLT/SPHERE frames from 2018 (`source/observations/`), cast through the terrain with the Dawn pole model, match the Dawn mosaic at a median +0.5°, all within 5°.

![Dawn mosaic predicted through the route beside the SPHERE frame](evidence/sphere-registration-2018-06-08.png)

## Known problems

- The visible mosaic has clipped bright terrain and registration artifacts, and the black-pixel mask can hide valid dark pixels.
- Clear-filter photography keeps the seams of the original mosaic. North of LAMO coverage the 60 m/pixel HAMO mosaic shows instead, so resolution and sun angle change, and the pole is very dark.
- Spectral ratios are not mineral abundances.
- GRaND maps resolve about 300 km; their pixels are sampling. The coarse maps show blocks 15° to 20° tall, the fast neutron level has an arbitrary offset, and uncertainties are not drawn.
- The geology dataset leaves 2,753 cells (0.13%) gray where the source has no polygon.
- Gravity resolves about 42 km at best (55 km for Bouguer). Radial gravity omits J2 and is not an anomaly. The geoid is withheld poleward of 60°. The frame is close to, not exactly, Claudia Double Prime.
- Terrain polar interpolation is not independent stereo coverage. The 8 km allowance is not an error bound.
- Feature outlines are not published nomenclature boundaries. Placement uses osculating elements with limited temporal validity.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)
