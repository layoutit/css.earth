# Io

Io is Jupiter's innermost Galilean moon, shown as a mean-radius sphere with photographic mosaics, a geology map, stereo elevation, VLT/MUSE maps and a night-side volcanic heat map.

## Sources

- **Monochrome:** USGS [Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_global_mosaic_1km), `Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif`.
- **False color:** USGS [Voyager/Galileo false-color global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_false_color_global_mosaic_1km), `Io_Galileo_SSI_Global_Mosaic_FalseColor_1km.tif`.
- **Geology:** the original `Io_GeoUnits` polygon/attribute/projection members from [USGS SIM3168](https://pubs.usgs.gov/sim/3168/), Williams et al. (2011), at 1:15,000,000.
- **Elevation:** the stereo terrain model of [White et al. (2014)](https://doi.org/10.1002/2013JE004591), served by NASA's [Io Trek](https://trek.nasa.gov/io/) as "Voyager ISS and Galileo SSI DEM 1000 mpp, Global" (product `IoDEM`, [catalogue record](https://trek.nasa.gov/io/TrekServices/ws/index/eq/searchItems?start=0&rows=5&key=IoDEM)). Heights come from Voyager and Galileo stereo pairs fitted to Galileo limb profiles.
- **VLT/MUSE:** original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinate evidence, first-valid-night coverage, registration limits and residual night differences.
- **Volcanic heat:** the registered JIRAM images, geometry and detector masks released with [Perry et al. (2025)](https://doi.org/10.3847/PSJ/adbae3), from [ASU](https://rgcps.asu.edu/juno/). [The recipe](source/science/jiram/perry-recipe.json) selects the release; [the measured receipt](source/science/jiram/perry-receipt.json) records screening and registration.
- **Named features:** the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Io (public domain per its FGDC metadata), kept under `source/features/`. 44 labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0), kept with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.
- NASA's [Io facts](https://science.nasa.gov/jupiter/jupiter-moons/io/facts/) support the introduction. The vendored astronomy package supplies Io's 1821.49 km mean radius, IAU/WGCCRE rotation and JPL orbit.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

**Photographs.** Both GeoTIFFs contain 11445 × 5723 samples on a 1000 m grid. Monochrome detail varies from approximately 1–10 km per pixel; color detail from 1.3–21 km per pixel. The false-color product combines Galileo near-infrared, green and violet color ratios with Voyager/Galileo monochrome detail. USGS reports calibration, geometric control, Lunar–Lambert limb-darkening correction with coefficient 0.7, and seam matching; we keep the published display values with no second photometric correction. The GeoTIFF georeference defines sampling, and `GDAL_NODATA=0` marks missing data. The raster lane samples the photographs into one 8,192 × 4,096 map, roughly 1.4 km per equatorial texel; source areas coarser than that stay coarse. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method.

**Geology.** Fourteen base-unit categories distinguish plains, flows, patera floors and mountains. Five diffuse-deposit classes belong to a separate overlay and are not rendered. `NoData` polygons, unmapped polar areas and conflicting overlapping categories remain missing.

**Named features.** Preparation converts each positive-east centre with the decoded map's left edge at 0° E and anchors it on the mesh. Craters and faculae trace a rim circle, other types their published extent box. [Pele's](https://planetarynames.wr.usgs.gov/Feature/4638) red deposit at 18.71° S, 104.72° E is an independent orientation landmark, and Pele selects it.

**Globe.** The world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts`. The thin sulfur-dioxide atmosphere does not justify a visible halo, so none is rendered. No simulated lava or plume is supplied.

## Evidence

### Stereo elevation

The Elevation dataset colors the Trek GeoTIFF's heights from −2 km (blue) to 6 km (dark red) with fixed northwest relief lighting. The original Float32 values are read directly; nothing is filled or smoothed. Neither the file, the Trek record nor its [FGDC metadata](https://trek.nasa.gov/io/TrekWS/rest/cat/metadata/fgdc/html?label=IoDEM) states the height unit or datum.

The heights are metres relative to Io's limb-profile ellipsoid, not to the header sphere. White and Schenk's [LPSC 2014 abstract 1534](https://www.hou.usra.edu/meetings/lpsc2014/pdf/1534.pdf) describes 70 stereo models fitted to the triaxial ellipsoid from 25 Galileo limb profiles; plains average 0.00 km and 89.9% lie within ±1 km. Our measurement agrees: 85.3% of all samples lie within ±1,000 m.

The Gazetteer shares the mosaic frame, so named mountains test the registration: 24 of 30 covered mountains, mesas, plana and tholi stand above a ring twice their radius (mean +813 m); with longitudes mirrored, 13 of 29 do (mean +40 m). The highest sample, 16,942 m at 88.83° E, 9.88° S, lies inside [Boösaule Montes](https://planetarynames.wr.usgs.gov/Feature/854). Valid heights cover 53.8% of the sphere by area, from the south pole to 66.8° N. Trek and the abstract say about 75%; the difference is unexplained.

### Registered volcanic heat (27 September 2026)

![Expanded night-side volcanic heat map](evidence/jiram-perry/heat-desktop.png)

Screening all 2,374 M-band images in the release's 27 orbit directories yields 378 usable frames on 17 visits between July 2017 and October 2023. The 1440 × 720 map covers **58.42% of Io's spherical surface**, reaching 50.125°S and 88.125°N. Color shows band radiance above a cold-column background, not temperature or total heat flow. The 0.25° grid is sampling, not uniform spatial resolution.

<details>
<summary>Processing, independent checks and reproduction</summary>

Perry et al., Appendix B defines the band-radiance values in W sr⁻¹ m⁻². The producer's [geometry code](https://github.com/volcanopele/juno/blob/fe0fea922b2531f0ff9e127a646301104067251d/jiramgeombackplane.py) uses west-positive longitude and SPICE planetographic latitude on an IAU_IO ellipsoid (radii 1829.4, 1819.4, 1815.7 km). Preparation inverts that convention and fits the camera model; the worst holdout error is 0.000219 pixels.

The released saturation masks, off-body samples and emission beyond 75° are withheld. The night-side rule keeps two projected pixel footprints away from the terminator. Each detector column needs 32 valid cold-night samples to set its median background, which removes reflections along columns from bright hot spots ([Perry et al. (2025), Section 2](https://doi.org/10.3847/PSJ/adbae3)); unsupported columns stay missing. Per-visit medians need at least three frames, then each cell takes the visit with the finest footprint. There is no gap filling or smear correction.

60 of 72 local peaks above 0.03 W sr⁻¹ m⁻² lie within 3° of a [Davies et al. (2024)](https://doi.org/10.3847/PSJ/ad4346) catalogue source, versus 13 with longitudes mirrored. This supports orientation and approximate locations; it does not identify all peaks or qualify absolute radiometry.

Reproduce with `node packages/bake/authoring/juno/jiram-registered-mosaic.mts src/objects/io/source/science/jiram/perry-recipe.json --inputs output/io-perry/inputs --fetch`. The fetch route requires curl and 7z and requests only the nested FITS members of the release ZIP.

</details>

## Known problems

- The atlas seams can remain visible at extreme close zoom.
- **False color:** USGS superimposed color from Galileo violet, green and near-infrared (756 nm) images; this is false color, not a visual true-color measurement. Io changed between the Voyager and Galileo observations; the mosaic is not a single-date snapshot, and boundaries remain visible. The color mosaic is soft around Pele.
- USGS states that color lacks coverage within approximately 5° of both poles and that merged polar color was interpolated, so color is withheld at |latitude| ≥ 85°. Valid monochrome replaces missing color; the gray grid appears only where neither source has imagery.
- **Geology:** Colors are authored categorical choices, not measured color, chemical abundance or elevation. The label-point layer differs from final polygon classifications at 43 of 1,498 comparable points.
- **Elevation covers 54% of Io,** none north of 66.8° N. Plains were smoothed with large stereo patches, so fine relief on the plains is not resolved. Heights are color only; the globe is a mean-radius sphere, not displaced.
- **Volcanic heat is night side only** and reaches about 50°S. Mura et al. keep the day side and remove reflected sunlight with a photometric model; we do not model sunlight.
- **Smear and residual artifacts remain.** A hot spot is often smaller than one detector pixel, so peaks must not be read as resolved lava boundaries.
- **Volcanic heat mixes dates.** Each cell comes from the orbit that saw it sharpest. Hot spots vary, so the composite does not describe a single date.
- Named feature outlines are not published nomenclature boundaries.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
