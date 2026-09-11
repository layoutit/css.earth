# Ganymede

## Sources

- [USGS Voyager/Galileo monochrome mosaic, 1 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_global_mosaic_1km): 16539 × 8270, one unsigned-byte band.

- [USGS Voyager/Galileo color mosaic, 1.4 km](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km): 11520 × 5760, three unsigned-byte bands.

- The Geology view uses [USGS SIM3237](https://pubs.usgs.gov/sim/3237/), Collins et al. (2013), at 1:15,000,000.

- The VLT/MUSE views use original July 2019 measured maps from King et al. The [source interpretation](source/muse/INTERPRETATION.md) defines units, coordinate evidence, first-valid-night coverage, registration limits and residual night differences.

## Evidence

- Six distributed point anchors, exact input hashes, and decoder failure cases are tested.

- Focused checks are defined in the [unit tests](../../../tests/objects/unit/ganymede) and [browser profile](../../../tests/objects/browser/ganymede/browser-profile.mts).

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Ganymede (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude counts from the map’s left edge, 180° from the Gazetteer origin. The map edge was fixed by cropping the source raster at a landmark’s Gazetteer centre under both hypotheses (see the pull request that added the feature).

- **Photographic views:** Neither is presented as unlit calibrated albedo or natural eye color.

- **Color coverage:** In the 210–250° west sector, Voyager measurements supplied green/blue while red was synthesized. This package conservatively uses the observed monochrome base throughout that sector (110–150° east), without claiming its synthesized red as measured color. The shared neutral cartographic grid appears only where no valid surface observation remains.

- The rendered shape is a mean-radius sphere, not a resolved terrain mesh.

- **Geology:** The separate point labels disagree with final polygon categories at 124 of 3,042 comparable locations; 870 ejecta labels are outside that comparison. The audit retains those disagreements.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

Ganymede is Jupiter's largest moon. This standalone package uses the common object runtime, camera, controls and retained surface. It does not mount other moons or a second scene.

## Sources and coordinates

The pinned inputs are recorded in `source/manifest.json`. Runtime installation requires prepared assets, not these source TIFFs. Source byte counts and SHA-256 identities are recorded in the manifest.

- The source observations have varying resolution, approximately 400 m–20 km/pixel. Coarse observed imagery is not replaced with invented high-resolution detail.

- Enhanced infrared color is merged with sharper monochrome structure; the map grid is finer than some original color observations.

- Pinned ISIS and PDS labels describe both map products. Both GeoTIFFs are simple cylindrical/equirectangular, planetocentric, centered at 180° with north at the top. Positive map x runs eastward. The monochrome ISIS label expresses longitude west-positive (decreasing along x); the color label is east-positive. No horizontal mirror is applied. Output longitude runs 0–360° east. The map sphere is 2632.345 km in radius.

Preparation maps canonical output pixel centres through each GeoTIFF's actual metric origin and increments using native bilinear interpolation. The monochrome outer longitude is −0.017414018° and its width spans 360.013060514°; the enhanced map also retains its own source bounds. Neither grid is stretched to an assumed 360° extent or rounded to an integer column shift.

## Appearance and coverage

**Monochrome** preserves the USGS observation mosaic. **Enhanced color** shows its independent infrared/green/violet interpretation.

[USGS map I-2762](https://pubs.usgs.gov/imap/i2762/) and the [USGS globe description](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_image_mosaic_globe) describe radiometric calibration, empirical Lunar–Lambert photometric normalization, and linear brightness corrections fitted to overlapping images. We retain this published processing; there is no additional guessed global photometric model. Photographed terrain shadows and varying source resolution can remain. The shared Shadows control adds approximate spherical lighting in both lenses.

The USGS color product maps SSI 991 nm to red, 559 nm to green and 413 nm to blue. Published monochrome polar coverage remains monochrome. No terrain is painted or extrapolated.

Both GeoTIFFs declare GDAL_NODATA=0. The monochrome zero value, or a missing color band, supplies the validity mask. Very dark nonzero terrain remains valid. Every native contributor with nonzero bilinear weight must be valid; incomplete or masked interpolation footprints are withheld. This replaces the earlier whole-image resize and roll, so prepared image bytes change while source values remain unchanged. Missing/withheld color uses co-located observed monochrome.

## Preparation and geometry

Prepared maps are 8192 × 4096 (about 2.02 km per equatorial texel), downsampled from the source. The canonical projective atlases are fixed across DPR. Poles use separate 1024-pixel disks sampled from the same map; each latitude band uses the shared inverse mapping for the retained spherical mesh. Proportional atlas gutters preserve the shared texture registration at this density.

Its 2631.2 km mean radius, pole/spin model, synchronous orbit and epoch come from the pinned astronomy package (JPL satellite elements and IAU/WGCCRE rotation). The small cartographic reference-radius difference remains a source-map fact, not a change to Ganymede's physical radius. Sky, Sun and Jupiter positions use the same prepared body frame and epoch. The parent Jupiter marker is prepared independently from the pinned Hubble photograph; it is not an embedded Jupiter scene. ESO/S. Brunier and HYG supply the shared astrometric sky.

[NASA Ganymede facts](https://science.nasa.gov/jupiter/jupiter-moons/ganymede/facts/) support the introduction, ocean interpretation, thin oxygen atmosphere and approximately 1.07 million km orbit. The tenuous atmosphere is factual content; it does not justify a visible atmospheric halo. No rings, terrain-height lens, magnetosphere illustration or speculative layer is included.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON. Reusable observation masking, projection, lighting, celestial, and retained-scene operations live in `tools/objects/terrestrial-layers/`; no package-local executable preparer or runtime is required.

Delivery keeps the prepared HD texture dimensions. Surface and polar atlases use WebP quality 90 with full-quality alpha; source maps remain lossless. The shared photographic sky uses quality 95. Lighting stays lossless. Only the selected sky mode is requested on first view.

## Interpreted geology

The original `GeologyUnits` SHP/DBF/PRJ files retain 3,046 records and 23 `Unit` symbols. The archive combines palimpsest age subdivisions under `p`; no finer age interpretation is invented. Colors are authored categorical display choices, not measured brightness, composition or relief. Structure lines and ejecta point symbols are outside this base-unit view.

`source/science/geology-sim3237/` retains raw members, readme/metadata, archive member integrity receipts, and independent label-point anchors. Coordinates are signed east-positive planetocentric degrees in `GCS_Ganymede_2000`, on the 2,632,345 m source sphere and RAND November 1999 control. Mapping those angles onto the existing 2,631,200 m displayed sphere adds no 1,145 m elevation offset. Only unambiguous polygons are colored; uncovered polar areas remain missing.

Record 3,023 contains one degenerate one-point ring and 90 valid rings. The decoder explicitly excludes that pinned zero-area ring while preserving the valid multipart region, and rejects any undeclared degeneracy. Prepared visual qualification belongs to the B2 record.

## Visible spectral surface views

Every conversion is offline; the scene geometry remains unchanged.

</details>
