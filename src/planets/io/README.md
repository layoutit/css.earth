# Io

## Sources

- **Monochrome:** USGS [Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_global_mosaic_1km), `Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif`.

- **Enhanced color:** USGS [Voyager/Galileo false-color global mosaic](https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_false_color_global_mosaic_1km), the Galileo SSI global false-color mosaic.

- The Geology view uses the original `Io_GeoUnits` polygon/attribute/projection members from [USGS SIM3168](https://pubs.usgs.gov/sim/3168/), Williams et al. (2011), at 1:15,000,000.

- The VLT/MUSE views use original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinate evidence, first-valid-night coverage, registration limits and residual night differences.

## Evidence

- Six distributed anchors, exact source hashes, hole/seam behavior, and categorical exclusion rules are exercised by the focused geology/source tests.

- Focused checks are defined in the [unit tests](../../../tests/objects/unit/io).

## Known problems

- **Enhanced color:** Its colors are enhanced and do not represent a visual true-color measurement. Io changed between the Voyager and Galileo observations; the mosaic is not a single-date snapshot, and spatial/brightness/color boundaries remain visible.

- USGS explicitly states that color lacks coverage within approximately 5° of both poles and that merged polar color was interpolated. We therefore withhold color at |latitude| ≥ 85° before resampling. Independently valid monochrome replaces missing or withheld color. The shared neutral gray grid appears only where neither source provides valid imagery.

- **Geology:** Colors are authored categorical choices, not measured color, chemical abundance or elevation.

- **Geology source audit:** The separate label-point layer differs from final polygon classifications at 43 of 1,498 comparable points.

- The scene is a mean-radius sphere, not a topographic shape model.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

Original false-color mosaic filename:

```text
Io_Galileo_SSI_Global_Mosaic_FalseColor_1km.tif
```

<a id="io-sources-and-preparation"></a>

Io is Jupiter's innermost Galilean moon. The scene uses the shared standalone object runtime, camera, shell and prepared lighting. Jupiter is a sourced distant parent marker in Io's system context; it is not another mounted surface scene.

## Body and frame

The vendored astronomy package supplies Io's 1821.49 km mean radius, IAU/WGCCRE body rotation and JPL parent-relative orbit. Solar and sky directions use the shared J2000 ICRF/ecliptic registration and the same prepared presentation frame as the body.

NASA's [Io facts](https://science.nasa.gov/jupiter/jupiter-moons/io/facts/) support the introduction and facts: intense tidal volcanism, synchronous rotation, roughly 422,000 km distance from Jupiter, and a thin sulfur-dioxide atmosphere. The atmosphere does not justify a visible halo, so none is rendered. No simulated lava, plume, thermal measurement or elevation lens is supplied.

## Observed surfaces

Exact source byte lengths, SHA-256 identities, credits and direct restoration URLs are in `source/manifest.json`.

Both GeoTIFFs contain 11445 × 5723 samples on a 1000 m grid. Actual monochrome detail varies from approximately 1–10 km per pixel. Color detail varies from 1.3–21 km per pixel; the published enhanced product combines Galileo near-infrared, green and violet color ratios with Voyager/Galileo monochrome detail. This is an existing USGS derived observation product, not a new detail transfer in cssEarth.

USGS reports calibration, geometric control, Lunar–Lambert limb-darkening correction with coefficient 0.7, and seam matching in production of these products. We preserve the published display values, with no second photometric correction or brightness fit. Photographed terrain shadows remain possible. Our existing **Shadows** control remains active for both lenses; its globe lighting is approximate and cannot infer relief hidden in a photographed shadow.

## Coordinates and validity

The GeoTIFF georeference, rather than the catalog's positive-west coordinate labels, defines raster sampling. Both products use a simple cylindrical sphere of radius 1821460 m, center longitude 0°, origin (-5723000, 2862000) m and pixel increments (+1000, -1000) m. East increases to the right, north is up. Preparation maps each canonical output pixel centre through the actual metric origin and increments, using native bilinear interpolation. The outer longitude is −180.022479853° and the map spans 360.013503743°; those fractional bounds are preserved rather than rounded to an integer roll or stretched to a full globe. Output longitude remains 0–360° positive-east, without horizontal reflection. [Pele's](https://planetarynames.wr.usgs.gov/Feature/4638) large red deposit at 18.71° S, 104.72° E (255.28° W) is an independent orientation landmark. The 30 m difference from the current astronomical mean radius is not interpreted as terrain.

`GDAL_NODATA=0` marks missing raster data. Monochrome uses exact zero; enhanced color requires the complete RGB tuple to be zero. Low but nonzero observed dark terrain is retained. Every native contributor with nonzero bilinear weight must be valid; incomplete or masked interpolation footprints are withheld. This coordinate correction replaces the earlier whole-image resize and roll, so prepared image bytes change while the original source values remain unchanged.

This is a conservative geographic cut based on the published approximate coverage boundary, not a recovered per-image observation mask. No synthetic terrain or extrapolated pole color is used.

## Prepared delivery

The shared `tools/objects/terrestrial-layers/solid-raster.mjs` operation produces lossless 4096 × 2048 maps, projective strip atlases and thumbnails; its material operation produces registered pole tiles and the same bounded lighting model used by the accepted shared solid-body path. The output's equatorial spacing is approximately 2.8 km per texel. Source areas coarser than this remain coarse. Canonical assets are selected once per mount, independently of DPR. Runtime only decodes and transports prepared assets.

The shared source-driven parent-marker operation prepares an independent 1024-pixel Hubble Jupiter image from the source entry in this package, so Io can be installed without Jupiter's surface package. Shared sky inputs are ESO/S. Brunier's Milky Way panorama and the HYG catalogue; their attribution files accompany the source manifest. Inter provides prepared title outlines.

Source restoration and prepared runtime installation are separate. The runtime inventory binds all assets needed by this package; installing prepared assets does not require acquiring the source GeoTIFFs.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON. Reusable observation masking, projection, lighting, celestial, and retained-scene operations live in `tools/objects/terrestrial-layers/`; no package-local executable preparer or runtime is required.

Delivery keeps the prepared HD texture dimensions. Surface and polar atlases use WebP quality 90 with full-quality alpha; source maps remain lossless. The shared photographic sky uses quality 95. Lighting stays lossless. Only the selected sky mode is requested on first view.

## Interpreted geology

Fourteen base-unit categories distinguish plains, flows, patera floors and mountains. Five diffuse-deposit classes belong to a separate overlay and are not rendered here. No terrain displacement is derived from these polygons.

Exact raw members and archive/member CRC32/SHA-256 receipts are retained in `source/science/geology-sim3168/`. The actual SHP is signed east-positive planetocentric degrees on a 1,821,460 m sphere. West-longitude point attributes independently verify the sign: the same first point is −97.1448317468° in SHP X and +97.144831747° in `Long_W`. The displayed 1,821,490 m radius retains those angular positions; the 30 m radius difference is not height. `NoData` polygons, unmapped polar areas and conflicting overlapping categories remain missing.

These source discrepancies and the explicit `Pb/Pby`, `Pw/Pbw`, `T/Tb` aliases are retained in the registration audit, rather than forcing label points to replace the polygon `Unit` attribute. The [original preparation and browser qualification](https://github.com/layoutit/cssEarth/tree/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b2-preparation/) records retain the tested version and results.

## Visible spectral surface views

Every conversion is offline; the scene geometry remains unchanged.

</details>
