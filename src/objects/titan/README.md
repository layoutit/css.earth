# Titan

## Sources

- **Near-infrared** is Cassini ISS CL1/CB3 at 937.994 nm (9.498 nm bandwidth), from [Weller et al., USGS 2026 release](https://doi.org/10.5066/P14FAEKS).
- **Radar** is the Cassini RADAR Team's mission-end MIDR S00 mosaic, combining SAR and HiSAR through flyby T126. The two original gzip PDS3 hemispheres are from the [Cornell archive](https://data.astro.cornell.edu/RADAR/DATA/MIDR/S00/).
- **VIMS infrared** (2 µm and 5 µm) and **Infrared band ratios** are the Cassini VIMS global mosaics of [Le Mouélic et al. (2019)](https://doi.org/10.1016/j.icarus.2018.09.017), made from about 19,000 cubes of flybys T0–T126 at 32 pixels per degree. The producer's only file release is on [NASA Titan Trek](https://trek.nasa.gov/titan/) (`Titan_global_32ppd_2microns_v2`, `_5microns_v2`, `_ColorRatio_v2`). They are 8-bit display images: no numeric reflectance (I/F) version is published, so they are shown as pictures, not measured values. The producer's portal distributes its VIMS data under CC BY 4.0 with the credit NASA/Caltech-JPL/University of Arizona/Osuna-CNRS-Nantes Université; the Trek files state no terms of their own.
- Formal `CO-SSA-RADAR-5-GTDR-V1.0` float products through T126 add three views: measured height (`GTF`), interpolated height (`GTI`) and distance to input data (`GTD`). Heights are metres above the 2575.0 km sphere, distance is kilometres.
- **Named features** come from the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Titan (public domain per its FGDC metadata), kept under `source/features/`. 58 labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0), kept with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year. One spacecraft landing site is labelled beside the IAU names (`source/features/sites.json`), quoting the page its coordinate was read from.
- The sphere uses the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 2,574.76 km (IAU 2015). Facts: [NASA Science](https://science.nasa.gov/saturn/moons/titan/facts/).

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Evidence

- **Measured height:** Independent source-cell decoding gives measured spherical area coverage 6.0000%. Source extrema and coordinate anchors are in [source/validation/b2-scalar-anchors.json](source/validation/b2-scalar-anchors.json).
- **VIMS registration:** Read as a normal map whose left edge is 180° E, the 2 µm mosaic correlates with the ISS mosaic at r = 0.85 (0.20 as georeferenced). Around Selk, Sinlap, Menrva and the Xanadu margin the three VIMS maps sit within about 6–17 km of the ISS features (a few 1.98 km texels). The unobserved south region then falls at 83–170° E, 75–80° S, where the paper places it (around 80° S, 120° E). Numbers and the comparison image are in evidence/vims-and-hisar.
- **Named features:** Gazetteer rims drawn over the prepared minimap agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`. The map edge was fixed by keeping the edge hypothesis where Menrva, Xanadu and the Kraken Mare shoreline on the ISS mosaic coincide with the imagery.
- **HiSAR T104 (not added):** the USGS 351 m mosaic lines up with the T126 Radar mosaic (no measurable shift), but its levels are an unpublished logarithmic stretch and it covers 61% of Titan against 75%. See the [ledger](investigations.json).

## Known problems

- **Near-infrared:** It is not visible color. This interpretation is source-informed: the release does not supply a separate PNG validity band.
- **VIMS infrared and band ratios:** Display levels only; the producer applied empirical photometric, haze and (for the ratios) airmass corrections and warns that clouds and artifacts remain. Seams and blocky low-resolution patches are visible where only distant observations exist. Kraken Mare appears as a bright sun glint, not dark liquid, so northern lake shorelines cannot be registered. The ratio colours are not visible colour; the polar pink is residual haze. Exact zero is withheld as missing (about 0.6% of the area: an unobserved region near 80° S, 83–170° E, thin polar caps and small holes); at 5 µm a few hundred of those isolated zero pixels may be clipped dark ground.
- **Radar:** Display brightness retains the byte levels; it is neither optical albedo nor elevation. Radar speckle and source swath boundaries remain.
- **Distance:** Distance is not uncertainty; the tiny negative GTD roundoff minimum −4.31e−11 km is preserved in source sampling and clamped by the visible zero endpoint.
- **GTDR qualification:** Source intake and recipe proposal only. Final mesh selection (where applicable), restored-source and prepared browser/visual gates remain pending.
- **Named features:** Outlines are not published nomenclature boundaries.
- **iPad footprint:** The default photographic normal surface uses quarter dimensions through the raster `resolutionScale` contract. This reduces display detail, not the resolution of the source observations or quantitative grids. Pole textures and the other datasets keep their resolutions.

[Inputs](source/manifest.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Near-infrared</summary>

<a id="titan-sources"></a>

The lossless PNG is the published display export of the controlled 23,048 × 11,524 global mosaic, on a 702 m grid, planetocentric and east-positive, with a 2,575,000 m map radius. No longitude mirror or polar terrain continuation is applied.

The PNG follows the [ISIS display export convention](https://isis.astrogeology.usgs.gov/9.0.0/Application/presentation/Tabbed/isis2std/isis2std.html): Null is zero and valid dark data starts at one. Only exact zero is withheld, including a small southern gap; valid dark dunes and lakes are preserved.

USGS already applied weighted mosaicking and a 31 × 31 high-pass filter. Its display levels and remaining haze, cloud features and patch boundaries are preserved. The 8,192 × 4,096 prepared map is about 1.98 km per equatorial texel; the 702 m source grid is not a claim of uniform native image resolution.

</details>

<details>
<summary>Radar</summary>

Preparation decodes the attached labels, uses their west-positive longitudes to place the pixels in our east-positive map, and preserves exact `MISSING_CONSTANT = 0` coverage. Valid low-backscatter lakes remain observed. The label documents incidence-normalized backscatter in logarithmic form: dB = DN × 0.10000012 − 20.10001.

The selected archive level is 32 pixels/degree (1.404 km at the equator), prepared at 8,192 × 4,096 (1.98 km per equatorial texel). The archive also has 351 m grids, but those are not the delivered texel density.

</details>

<details>
<summary>VIMS mosaics</summary>

Each Trek file is an uncompressed 11,520 × 5,760 GeoTIFF of unsigned bytes (one band at 2 and 5 µm; three for the ratios, red 1.59/1.27, green 2.03/1.27 and blue 1.27/1.08 µm per its GDAL band names). There is no scale, offset or no-data tag. Its georeference pairs degree tie points (360° at the left edge, pixel size −0.03125°) with a metre-based Plate Carrée centred on 180°; read literally it would mirror the map. A search over every longitude shift and both column orders against the ISS mosaic finds one clear answer: stored column 0 is 180° E and longitude increases to the right, so the recipe declares `centerLongitude: 0`. Exact zero in every band is missing.

</details>

<details>
<summary>Height and distance views (GTDR)</summary>

Attached labels identify little-endian PC_REAL 32-bit values and exact `FF7FFFFB` missing bits. Two 1440 × 1440 west-positive planetographic hemispheres are decoded from source offsets. Posting is 8 pixels/degree, about 5.62 km at the equator; it is not a footprint or accuracy claim. The 2019 labels list adjusted altimetry and SARtopo. Interpolated grids have small missing regions and those remain missing.

Height colors use a common −2500 to +2500 m scale across measured and interpolated views. Distance uses 0–1000 km. Terrain geometry remains the sphere; these maps do not invent global physical relief.

</details>

<details>
<summary>Globe, rotation and named features</summary>

Titan uses the shared raster lane with the shared 16 × 32 sphere mesh and Lambert lighting bank, and no atmosphere. Polar sprites sample the original photographs directly ([shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)). The world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts`. The [navigation marker](source/preparation/navigation.json) is a stylized source-map crop, not a view at the scene epoch.

Named features are anchored with the map's left edge at 0° E. Craters and faculae trace a rim circle, other types their published extent box. Landing sites are unsized points ranked like a 20 km feature.

</details>
