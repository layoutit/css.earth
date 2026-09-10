# Phoebe sources and preparation

## Paired 2023 products

The four existing SPC views use [Weirich et al. 2023, DOI 10.26033/3k3c-5713](https://doi.org/10.26033/3k3c-5713), PDS bundle `urn:nasa:pds:satellite-phoebe.cassini.shape-models-maps::1.0`. Original OBJ, numeric ISIS cubes, detached labels, image/kernel inventories and product/assessment documentation are pinned beside the body. The model uses Cassini 2004 encounter observations; a 2023 release date is not a new spacecraft encounter.

The default **Relative albedo** lens is a normalized SPC brightness estimate near mean one, not natural color, physical geometric albedo, composition or a directly photographed texture. The Q512 cube contains finite interpolated values even in unsupported areas. The albedo and Radial height views require both at least five images and a valid finest-maplet spacing no worse than 1500 m/vertex. This conservative display policy follows the source caution about low image counts; even many images need not provide independent viewing angles. It is not a published binary truth mask.

**Radial height** is the paired Q512 radius cube in meters, converted to km and reduced by a 106.5 km spherical reference radius. Its −15 to +15 km scale covers the retained source values. This is not a geoid, independent altimetry, or an assertion that the 1.195 km Q128 displayed geometry resolves the ~301 m raster. Fixed cartographic relief is separate from the directional Shadows control.

**Maplet resolution** displays the best contributing SPC maplet spacing in each 1° cell. Actual array values are 125, 250, 300, 500, 750, 1000 and 1500 m/vertex, with 6,714 missing cells whose literal value is 99999. The product prose says 9999; all 64,800 source cells were checked, and none contain 9999. The recipe withholds the actual 99999 sentinel. Smaller GSD is not an error estimate. **Image count** retains all 0–87 values, including 3,278 zero-image cells. Counts are coverage diagnostics, not confidence probabilities.

## Grid, frame and geometry

The native Q512 radius/albedo cubes are 2222 × 1111 Real LSB ISIS3 pixels at 301.26023555494 m; quality maps are 360 × 180 at 1858.775653374 m. The source specifies SimpleCylindrical, planetocentric latitude, PositiveEast, center longitude 180°, and a 106500 m sphere. Both longitude limit keywords are absent. A narrow explicit loader option verifies the native global pixel footprint from the exact origin/resolution/dimensions. It preserves the albedo/radius edge padding to 360.1296596434412° and −90.06482982171792° rather than resizing or inventing label fields. Numeric sampling and support masks use nearest source pixels. Outside the geographic sphere and valid support mask is withheld. Display raster size does not add source resolution.

The paired official OBJ has 99,846 vertices and 196,608 triangles in km. Its +X axis is 0° longitude and +Z the positive pole. The release documents the same source images and SPICE kernels as the older model, minor processing changes, and a 1.03 km shift to the center of figure. The exact published XYZ coordinates are retained, without an inferred compensating translation. The source-preserving display uses 3500 faces with a closed, consistently wound single-component topology (Euler 2). Solver estimated error and independent barycentric samples are recorded separately in `source/validation/2023-geometry-qualification.json`; the scientific uncertainty remains spatially variable. Source GSD and these rendering approximation checks are not absolute mapping accuracy.

The retained source-model orientation is RA 356.90°, Dec 77.88°, W = 178.58° + 931.639° per day from J2000. The 2023 release does not publish a replacement pole solution; its image/kernel identity and paired body coordinates are explicit. Current rotation phase is not newly qualified. Physical radius and orbit continue to use the JPL-backed astronomy package.

## Retired mounted view and unresolved alternatives

The original Cassini/DLR monochrome PDS mosaic and older Gaskell Q128 input remain acquisition-pinned historical references. The earlier Monochrome lens is deliberately replaced by the paired 2023 Relative albedo default: the old image map has not been registered to the changed center and shape, and blindly draping it would mix source frames. This is an explicit view change, not a claim that modeled albedo is a new photograph.

The earlier SBIB regional RGB candidate uses a different reference ellipsoid/shape convention; its calibrated RED channel confirms resolved imagery exists, but that product has no qualified RGB-to-shape registration. Published VIMS absorption figures also remain distinct from a reusable, registered numerical release. B9 instead derives the explicitly regional maps below from one qualified original VIMS cube; it does not turn these unresolved alternative products into global color or composition.

## Reproduction and qualification

`source/manifest.json` and `source/preparation/acquisition.json` retain original URLs, lengths and SHA256s. Source-owned numeric recipes produce surfaces, atlases, minimaps and a regenerated radial navigation context ahead of runtime. Native data fixtures check all four cube arrays, the literal missing sentinel and low/zero-count geographic samples. Separate NumPy ray intersections test the six cardinal directions of the exact official OBJ. Package preparation, browser interactions and visual limits must be qualified on the resulting prepared bytes before calling this upgrade ready.

## Cassini VIMS infrared and water-ice maps (B9)

The two additional surface views use original calibrated RC19 C cubes, matched
navigation N cubes and original PDS QUB detector/background data from the
[Nantes VIMS archive](https://vims.univ-nantes.fr/). Originals, exact wavelengths,
source masks, calibration arithmetic, observer timing and prepared source maps
are pinned in `source/cassini-ice/prepare.json` and `source/manifest.json`.

Infrared assigns native channels near 2.02, 1.59 and 1.28 µm to red, green and blue.
It is false color with an explicit common per-body stretch. Ice absorption is
`1 - R(near 2.02 µm) / continuum(near 1.82 µm, near 2.20 µm)` at the exact per-cube
wavelengths. It is not abundance. Calibrated float32 I/F and derived depth values
are retained, including valid negative measurements; only display colors saturate at
the authored legend/stretch limits. No photometric correction or observation
level matching is applied. Grain size, viewing geometry, illumination, noise
and archive filtering affect the signal.

Source support comes from native detector apertures and sampled exposure
geometry. Original saturation, special values, missing background and their
archive-filter dependencies are excluded per band. Numerical source maps do
not interpolate gaps into new measured coverage. The source grid is a sampling
choice, not additional native resolution. Exact observation/source-pixel
companion TIFFs preserve ownership. Infrared display packing follows the existing
photographic bilinear/WebP path, which can soften mask edges; the scalar ice
view uses nearest sampling. The final colors use the existing preparation,
meshes and retained CSS scene.

Registration limits and source-selection dispositions are recorded in
`source/cassini-ice/evidence/registration.md` and the
[B9 review](../../../docs/moons/b9-cassini-ice-surfaces/README.md).

Phoebe uses 41 native pixels from IR 1465671822_1 after a separately qualified source-camera fit and source-frame transfer onto the unchanged 3500-face mesh. The fitted origin offset is not an author-supplied vector. IR 1465670650_1 is withheld for systematic independent holdout bias. Mapping remains coarse and regional.
