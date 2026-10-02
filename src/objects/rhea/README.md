# Rhea

`/rhea/` shows Cassini and Voyager data on the IAU triaxial ellipsoid. The [navigation marker](source/preparation/navigation.json) is a stylized identifier, not an observer projection or illumination at the scene epoch.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Monochrome | [USGS Cassini–Voyager mosaic, 2012](https://astrogeology.usgs.gov/search/map/rhea_cassini_voyager_global_mosaic_417m) | About 417 m/pixel. Source shadows and seams remain; documented gaps are gridded. |
| Enhanced color | [NASA/JPL PIA18438](https://www.jpl.nasa.gov/images/pia18438-color-maps-of-rhea-2014/) | Includes ultraviolet and infrared information, beyond human-eye color. |
| Shape | [IAU 2015 radii](https://doi.org/10.1007/s10569-017-9805-5), NAIF [pck00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc) | 765.0 × 763.1 × 762.4 km, long axis toward Saturn. |
| Elevation | [Weirich et al. (2025), v1.0](https://doi.org/10.26033/tqxb-q714) | Color shows modeled height above a 763.5 km reference sphere. |
| Relative albedo | [Weirich et al. (2025), v1.0](https://doi.org/10.26033/tqxb-q714) | Relative brightness, with no units. Terrain and shadows affect its values; it is not calibrated reflectance. |
| Infrared and ice absorption | [Scipioni/Combe VIMS collection](https://doi.org/10.17189/ctqe-ta30) | Infrared is false color. Absorption is a spectral indicator, not ice percentage, grain size or temperature. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/RHEA/target) Rhea centre-point export, snapshot 2026-09-11, public domain. Labels appear at the closest zoom only. |
| Feature notes | Lead summaries of 4 English Wikipedia articles (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata, in `source/features/notes.json`. |
| Physical facts | The [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 763.50 km; [NASA](https://science.nasa.gov/saturn/moons/rhea/) rounds it to 764 km. |

Elevation and relative albedo come from [Weirich, Gaskell, Palmer and Domingue (2025), Rhea SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichrheashape.html), NASA PDS. Source selections, trials and open questions are in the [investigation ledger](investigations.json).

## Processing

**Monochrome.** The pinned `Rhea_Cassini_Voyager_mosaic_global_417m.tif` is 11520 × 5760 on a 764.1 km sphere and includes the March 2012 Cassini flyby; six Voyager images cover the north pole. The catalog download link wrongly points to the older 833 m Voyager map. The GeoTIFF's left edge is 180° E, and preparation rolls it by the actual origin without mirroring. Exactly zero is no-data and gets the gray grid.

**Enhanced color.** PIA18438 (2014-11-04, 12015 × 6008, about 400 m/pixel) was calibrated, registered and photometrically corrected by Paul Schenk. It starts at 0° E. It has no validity mask, so all pixels are kept. Hemisphere differences include real surface alteration and E-ring dust.

Both photographs are sampled from their original grids with a 2 × 2 footprint into the globe's latitude bands, in WebP quality 95 ([method](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)). Display atlases use quarter dimensions, which reduces display detail but not the source data.

**Elevation.** The 2222 × 1111 raster stores radius in metres; height is `radius * 0.001 - 763.5` km on a −10 to +10 km scale, with northwest relief at true height scale. The model uses 2719 Cassini images through 2015-02-15 at about 2.15 km spacing. Narrow strips at the east and south edges are gray, without extrapolation.

**Shape.** The globe is the IAU ellipsoid, drawn as 16 latitude bands of 32 leaves and two polar caps (452 leaves). The long axis takes the display radius; the other axes keep their ratios. Relief is not modelled on the globe; Elevation shows it. Until 2026-09-30 the globe was a 2,000-triangle reduction of the SPC Q128 OBJ; the [investigation ledger](investigations.json) records why it was replaced.

**Relative albedo.** Values are dimensionless and normalised around 1, shown on a 0.5–1.5 scale that saturates above 1.5. The GeoTIFF ends at 359.151742419° East and 89.575871210° South, and those strips stay missing.

**VIMS.** The [VIMS interpretation](source/vims/INTERPRETATION.md) defines the fields and conversion; `source/vims/prepare-maps.json` specifies it. Infrared shows three measured reflectance channels in false color. Ice absorption is a continuum-relative indicator. The archived mission-to-mosaic reduction is not reproduced.

Rings are not rendered: the debris disk inferred by [Jones et al. 2008](https://doi.org/10.1126/science.1151524) was not found by the Cassini imaging search of [Tiscareno et al. 2010](https://doi.org/10.1029/2010GL043663). The very tenuous exosphere gets no halo.

## Evidence

- Shape: at equal mean size, the vertices of the former 2,000-triangle Q128 mesh lie 0.17% of the radius from the ellipsoid (RMS), 0.81% at most; a sphere gave 0.22% and 0.91%. All 3,984 label anchor and outline points lie on the drawn surface within 0.01%.
- Map orientation is checked against [Tirawa](https://planetarynames.wr.usgs.gov/Feature/6026), 34.2° N, 208.3° E, and [Inktomi](https://planetarynames.wr.usgs.gov/Feature/14671), 14.1° S, 247.9° E.
- Reading and interpreting the original VIMS files were checked independently. Tests check the albedo source cells and both unfilled strips.

## Known problems

- The globe has no relief. Image seams, shadows, coarse inserts and numeric-map gaps remain. No inpainting or shadow removal is applied.
- The elevation producer's one-to-two-grid-spacing estimate comes from simulation experience, not per-cell uncertainty. It is a derived terrain model, not imagery.
- Relative albedo is a secondary SPC product, less validated than topography. The [producer's assessment](https://sbnarchive.psi.edu/pds4/cassini/satellite-rhea.cassini.shape-models-maps/document/rheashapeassessment.pdf) documents terrain and shadow effects in its values.
- Absolute VIMS registration at fractions of a source pixel is unresolved.
- The [old catalog](source/observations/catalog.json) still says relative albedo was excluded, although the current recipe and content include it.
- Feature outlines are not published nomenclature boundaries.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
