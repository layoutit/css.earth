# Phoebe

## Sources

- The mounted views use [Weirich et al. 2023, DOI 10.26033/3k3c-5713](https://doi.org/10.26033/3k3c-5713), PDS bundle `urn:nasa:pds:satellite-phoebe.cassini.shape-models-maps::1.0`.

- The model uses Cassini 2004 encounter observations; a 2023 release date is not a new spacecraft encounter.

- **Radial height** is the paired Q512 radius cube in meters, converted to km and reduced by a 106.5 km spherical reference radius.

- **Maplet resolution** displays the best contributing SPC maplet spacing in each 1° cell. Smaller GSD is not an error estimate. **Image count** retains all 0–87 values, including 3,278 zero-image cells. Counts are coverage diagnostics, not confidence probabilities.

## Evidence

- Original OBJ, numeric ISIS cubes, detached labels, image/kernel inventories and product/assessment documentation are pinned beside the body.

- **Geometry:** Solver estimated error and independent barycentric samples are recorded separately in [source/validation/2023-geometry-qualification.json](source/validation/2023-geometry-qualification.json); the scientific uncertainty remains spatially variable.

## Known problems

- The default **Relative albedo** lens is a normalized SPC brightness estimate near mean one, not natural color, physical geometric albedo, composition or a directly photographed texture. The Q512 cube contains finite interpolated values even in unsupported areas.

- **Support mask:** The albedo and Radial height views require both at least five images and a valid finest-maplet spacing no worse than 1500 m/vertex. This conservative display policy follows the source caution about low image counts; even many images need not provide independent viewing angles. It is not a published binary truth mask.

- **Qualification:** Current rotation phase is not newly qualified. Package preparation, browser interactions and visual limits must be qualified on the resulting prepared bytes before calling this upgrade ready.

- The SBIB regional RGB cube uses a different reference ellipsoid/shape convention; raw calibrated RED footage confirms resolved imagery exists, but no qualified RGB-to-shape registration is claimed.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="phoebe-sources-and-preparation"></a>

## Paired 2023 products

Its −15 to +15 km scale covers the retained source values. This is not a geoid, independent altimetry, or an assertion that the 1.195 km Q128 displayed geometry resolves the ~301 m raster. Fixed cartographic relief is separate from the directional Shadows control.

Actual array values are 125, 250, 300, 500, 750, 1000 and 1500 m/vertex, with 6,714 missing cells whose literal value is 99999. The product prose says 9999; all 64,800 source cells were checked, and none contain 9999. The recipe withholds the actual 99999 sentinel.

## Grid, frame and geometry

The native Q512 radius/albedo cubes are 2222 × 1111 Real LSB ISIS3 pixels at 301.26023555494 m; quality maps are 360 × 180 at 1858.775653374 m. The source specifies SimpleCylindrical, planetocentric latitude, PositiveEast, center longitude 180°, and a 106500 m sphere. Both longitude limit keywords are absent. A narrow explicit loader option verifies the native global pixel footprint from the exact origin/resolution/dimensions. It preserves the albedo/radius edge padding to 360.1296596434412° and −90.06482982171792° rather than resizing or inventing label fields. Numeric sampling and support masks use nearest source pixels. Outside the geographic sphere and valid support mask is withheld. Display raster size does not add source resolution.

The paired official OBJ has 99,846 vertices and 196,608 triangles in km. Its +X axis is 0° longitude and +Z the positive pole. The release documents the same source images and SPICE kernels as the older model, minor processing changes, and a 1.03 km shift to the center of figure. The exact published XYZ coordinates are retained, without an inferred compensating translation. The source-preserving display uses 3500 faces with a closed, consistently wound single-component topology (Euler 2). Source GSD and these rendering approximation checks are not absolute mapping accuracy.

The retained source-model orientation is RA 356.90°, Dec 77.88°, W = 178.58° + 931.639° per day from J2000. The 2023 release does not publish a replacement pole solution; its image/kernel identity and paired body coordinates are explicit. Physical radius and orbit continue to use the JPL-backed astronomy package.

## Retired mounted view and unresolved alternatives

The original Cassini/DLR monochrome PDS mosaic and older Gaskell Q128 input remain acquisition-pinned historical references. The earlier Monochrome lens is deliberately replaced by the paired 2023 Relative albedo default: the old image map has not been registered to the changed center and shape, and blindly draping it would mix source frames. This is an explicit view change, not a claim that modeled albedo is a new photograph.

Published VIMS absorption figures are scientifically distinct, but a reusable numeric map with complete projection/validity has not been closed. Neither becomes invented global color or composition.

## Reproduction and qualification

`source/manifest.json` and `source/preparation/acquisition.json` retain original URLs, lengths and SHA256s. Source-owned numeric recipes produce surfaces, atlases, minimaps and a regenerated radial navigation context ahead of runtime. Native data fixtures check all four cube arrays, the literal missing sentinel and low/zero-count geographic samples. Separate NumPy ray intersections test the six cardinal directions of the exact official OBJ.

</details>
