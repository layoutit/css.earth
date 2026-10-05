# Bennu

## Sources

| View or property | Source and interpretation |
| --- | --- |
| Albedo and Monochrome | [NASA SVS release](https://svs.gsfc.nasa.gov/5069): 6.25 cm zero-phase albedo on OLA v20 and separate 5 cm PolyCam basemap. They use different normalization/control and do not fill each other’s gaps. |
| Spectral composite | [USGS MapCam](https://astrogeology.usgs.gov/search/map/bennu-osiris-rex-ocams-photometric-mosaics-25cm), [DellaGiustina et al. 2020](https://figshare.com/articles/journal_contribution/Maps_DellaGiustina_et_al_Science_2020_abc3660/12996494). False color: red x/v (847/550 nm), green 698 nm band strength, blue b′/v (473/550 nm); no mineral abundance is inferred. |
| Shape and Elevation | [OLA v20 PTM](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005069/g_00880mm_alt_ptm_0000n00000_v020.obj); radius minus 241 m, not gravitational height. |
| Geopotential height and Slope | [OLA v20 1.68 m facet tables](https://sbnarchive.psi.edu/pds4/orex/orex.altimetry/data_derived_altimetry_lidar_global_models/global_digital_terrain_models/OLAv20/) (orex.altimetry): height above the lowest surface potential and slope against gravity plus spin, uniform density 1194 kg/m³. |
| Gravity anomaly | [RSWG_bouguer_map_shape_Oct2021](https://sbnarchive.psi.edu/pds4/orex/orex.derived_gravity_v1.1/data/) (orex.derived_gravity v1.1) on SPC v42: measured minus uniform-density surface acceleration, in percent. |
| Thermal inertia | [OTES global map, Detailed Survey stations 1–7](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/data_thermal_maps/global_thermal_inertia_maps/) (orex.thermal) on SPO v34; [Rozitis et al. 2020](https://doi.org/10.1126/sciadv.abc3699). |
| 2.7 µm and 3.4 µm bands | [OVIRS EQ3 maps](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/data_vnir_maps/detailed_survey/) (orex.spectral_analysis) on SPC v20; [Simon et al. 2020](https://doi.org/10.1126/science.abc3522). |
| Named features | IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile, retrieved 2026-09-18, public domain as USGS-produced data |

Pole and spin come from [bennu_v17.tpc](https://naif.jpl.nasa.gov/pub/naif/pds/pds4/orex/orex_spice/spice_kernels/pck/bennu_v17.tpc); see also the [mission facts](https://science.nasa.gov/mission/osiris-rex/). The OSIRIS-REx inputs are attributed to the OSIRIS-REx mission and spacecraft, not to the later OSIRIS-APEX mission ([catalogue contract](../../../docs/architecture/exploration-catalog.md)).

## Reflected light

The wavelength arrows select four MapCam maps from the USGS v2 release (4 August 2025) at 473, 550, 698 and 847 nm, corrected for illumination with the mission’s ROLO model. All four share a linear 0–0.08 I/F display range so brightness can be compared between wavelengths. The gray grid shows missing coverage, including the poles. The spectral composite is a separate dataset, read as published with no new contrast curve or recalculated ratios.

## Derived maps

Six datasets show the mission's own derived facet tables, one value per triangle of the shape model it was computed on. Each dataset is read from its own archived mesh and drawn on the body's one mesh, the OLA v20 model at 800 triangles: a texel takes the value of the nearest triangle of the dataset's full mesh, within 10 m of the point it is drawn at; nothing is interpolated between triangles. The meshes share Bennu's body-fixed frame. Until 5 October 2026 each of the four archived meshes was also drawn, simplified to 800 triangles of its own, and picking one of these datasets swapped the whole mesh. Read across models, a map withholds at most 0.05 points more of its texels (the OVIRS maps 0.27% against 0.22%, thermal inertia 0.48% against 0.45%).

| Dataset | Product (PDS4 LIDVID ends `::1.0`) | Mesh | Archived values | Display range |
| --- | --- | --- | --- | --- |
| Geopotential height | `g_01680mm_alt_elv_0000n00000_v020` | OLA v20, 786,432 facets | 0 to 84.7 m | 0–90 m |
| Slope | `g_01680mm_alt_slp_0000n00000_v020` | OLA v20, 786,432 facets | 0.03° to 107.9°, median 21.3° | 0–80° |
| Gravity anomaly | `rswg_bouguer_map_shape_oct2021` | SPC v42, 196,608 facets | −3.49% to +2.61% | ±3.5% |
| Thermal inertia | `g_06330mm_ta_thermin_otesdsv1-7_v001` | SPO v34, 49,152 facets | 190 to 383 J m⁻² K⁻¹ s⁻½; 194 facets empty | 180–400 |
| 2.7 µm band | `g_3170mm_sp_ovirs_eq3_oh2700nm_wavc_0000n00000` | SPC v20, 196,608 facets | 8.6% to 17.4%; 367 facets empty | 11.8–15.9% |
| 3.4 µm band | `g_3170mm_sp_ovirs_eq3_bandarea3200to3600nm_wavc_0000n00000` | SPC v20, 196,608 facets | −0.007 to 1.12 %·µm; 367 facets empty | 0.28–0.70 %·µm |

OLA and thermal-inertia ranges cover the archived values. The OVIRS ranges are the [producer readme](https://sbnarchive.psi.edu/pds4/orex/orex.spectral_analysis_v1_0/data_vnir_maps/detailed_survey/ovirs_eq3_maps_readme.txt)'s suggested stretch, mean ± 2 standard deviations.

The shape is the OLA v20 model scaled to a 0.241 km radius, welded and simplified by meshoptimizer to 800 faces. Elevation colors use the nearest point on the full source surface within 10 m; ambiguous samples are withheld with the gray grid. The shared frame is fixed at 2026-09-03 TT and rotation follows the mission PCK. Named features are cast onto the shape model; rim circles and extent boxes are not published boundaries. One landing site is labelled from `source/features/sites.json`, quoting the page it was read from.

## Evidence

- OLA v20: the archive's 0.88 m tables reproduce [Daly et al. 2020](https://doi.org/10.1126/sciadv.abd3649) Table 1, with slopes of 0.0° to 113.0° and a median of 24.6°. The datasets use the 1.68 m tables of the same model, whose median is lower (21.3°).
- Gravity anomaly: [Scheeres et al. 2020](https://doi.org/10.1126/sciadv.abc3350) give variations of about ±3% from a degree-4 field; the archived degree-10 map spans −3.49% to +2.61%. Positive is stronger than uniform density.
- Thermal inertia: the mean is 296 (SD 28). Rozitis et al. 2020 give 300 ± 30, with the equator 40–60 higher than high latitudes, as seen here.
- 2.7 µm band: the 5th–95th percentiles are 12.2–15.4% and depth grows toward both poles. Simon et al. 2020 report 12 to 17% correlated with latitude.
- Every table row matches the centroid of its triangle within 0.08 mm.
- The simplified shape lies a mean 1.468 m and a sampled maximum 10.120 m from the full source.
- The photographic atlas samples each original grid directly with a 2 × 2 texel footprint ([preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)).

## Known problems

- Derived-map labels disagree with their FITS tables in places, and the table decides. The OVIRS labels give 49,152 records where the tables hold 196,608. The 2.7 µm label says percent but the values are fractions, so the dataset multiplies by 100. The OLA headers name a different mesh file, and the gravity map has no uncertainty column.
- The thermal-inertia map has 194 NaN facets and the OVIRS maps 367 null facets. They stay gray.
- Slope and geopotential height assume uniform density, which the gravity anomaly map shows is only an approximation.
- The OVIRS maps sit on a January 2019 shape (SPC v20) and the thermal-inertia map on a June 2019 one (SPO v34). Neither is the display shape.
- Shadows on uses diffuse display lighting, not the mission's photometric model. Compare band brightness with Shadows off.
- Fine triangle-edge artifacts remain visible in smooth areas. They are a rendering limitation, not source terrain.
- The MapCam maps use spherical placement on the shape, so individual boulders do not register perfectly. The composite covers about ±65° and must not be stretched to the poles.
- The zero-phase albedo map covers about 55° S–55° N and leaves the poles missing. The differently normalized PolyCam mosaic stays a separate view. The publisher's 0.002–0.007 albedo stretch is kept.
- The Gazetteer export changes upstream; the browser probe of named features was not re-run against the 2026-09-18 export.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
