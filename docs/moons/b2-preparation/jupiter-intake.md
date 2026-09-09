# B2 Jupiter scientific surface intake

The cohort adds **Io geology, Ganymede geology, and Agenor relative terrain on
Europa**. These are new scientific products beyond the existing monochrome and
enhanced-color mosaics. Source/decoder qualification is complete; prepared
images, focus behavior, and real-browser visual qualification remain pending.

Implementation base: `98ef3269a6f965cbf7d1434d6484876953f24eba`, branch
`feat/moons-scientific-surfaces`. No new checkout, remote publication, or PR was
created for this intake. Existing prepared output remains from the preceding
qualified build until the coordinated B2 preparation run.

## Selected products

| Body | Scientific product | Retained quantitative meaning | Main limit |
| --- | --- | --- | --- |
| Io | [USGS SIM3168](https://pubs.usgs.gov/sim/3168/), Williams et al. (2011), `Io_GeoUnits` | Fourteen interpreted base-unit categories, 1:15,000,000 map scale | Separate diffuse-deposit overlays and structure lines are not rendered; no measured relief |
| Ganymede | [USGS SIM3237](https://pubs.usgs.gov/sim/3237/), Collins et al. (2013), `GeologyUnits` | Twenty-three archived `Unit` symbols, 1:15,000,000 map scale | The archive combines palimpsest age subdivisions under `p`; gaps remain unknown |
| Europa | [USGS controlled Galileo DTMs](https://stac.astrogeology.usgs.gov/docs/data/jupiter/europa/europa_controlled_usgs_dtms/), Agenor | Original released relative stereo heights in meters | Regional independent relative datum, not a global elevation reference; quality products are broken and excluded |

### Io

The exact release is
[`Io_SIM3168_Database.zip`](https://pubs.usgs.gov/sim/3168/Io_SIM3168_Database.zip).
Selected original members are under
`Io_SIM3168_Database/Io_Geology_SIM3168_shapefiles/`. The rendering inputs are
`Io_GeoUnits.shp`, `.dbf`, and `.prj`. Separate `Io_GeoUnitsPoints` files supply
independent label and coordinate checks. Diffuse-deposit files were acquired as
candidate evidence and remain outside the rendered base-unit view.

The shape contains 1,502 records: 1,500 classified polygons and two `NoData`
records. Fourteen base categories are retained exactly by their `Unit` symbols.
The source is interpreted geology from the Voyager/Galileo mosaic; the map's
nineteen-unit total includes five diffuse-deposit categories in a separate
overlay. This implementation does not falsely claim to display all nineteen.
Colors are authored categorical display choices, not copied publication colors,
measured surface colors, composition abundances, or elevations.

The actual geographic SHP uses signed east-positive decimal degrees despite
west-longitude labels in the publication. This is independently resolved by all
populated `Long_W` attributes in the separate point file. For example, its first
point has SHP X = −97.14483174681664° and `Long_W` = +97.144831747°.
The CRS is `GCS_Io_2000`, a planetocentric sphere of radius 1,821,460 m. The
existing displayed body radius is 1,821,490 m: angular registration is retained,
and the 30 m difference is not interpreted as height. Original polar gaps,
`NoData` polygons and conflicting category overlaps are withheld.

The point and polygon layers are not identical classifications: 1,455 of 1,498
comparable point labels agree; 43 disagree and two are blank. The aliases
`Pb→Pby`, `Pw→Pbw`, and `T→Tb` are explicit. Those discrepancies are retained in
`src/planets/io/source/science/geology-sim3168/registration-anchors.json`; they are
not used to overwrite the final polygon `Unit` field. Six distributed agreeing
points anchor the preparation tests in both hemispheres.

### Ganymede

The exact release is
[`Ganymede_SIM3237_Database.zip`](https://pubs.usgs.gov/sim/3237/downloads/Ganymede_SIM3237_Database.zip).
Selected members are under
`Ganymede_SIM3237_Database/Ganymede_Geology_SIM3237_Shapefiles/Ganymede_GlobalGeology_15M/`.
The rendering inputs are `GeologyUnits.shp`, `.dbf`, and `.prj`; the separate
`GeologyUnitPoints` files provide source anchors. Original readme/metadata and
sidecar shape indexes are retained.

The archive has 3,046 polygon records. `Unit` is authoritative for the displayed
category; descriptive `TERRAIN`/`UNITNAME` fields are not silently substituted
where they disagree. In particular, the common `p` symbol does not establish an
age class. One source defect is explicit: record 3,023 has 91 rings, and ring 0
contains only the point (−179.9998779296875°, 72.97808837890625°). Only this
zero-area ring is excluded; the other 90 valid rings remain. Any unexpected
degenerate ring fails decoding.

The CRS is `GCS_Ganymede_2000`, signed east-positive planetocentric degrees on a
2,632,345 m sphere, using the release's RAND November 1999 control framework.
The displayed sphere is 2,631,200 m; the 1,145 m difference is not elevation.
No polygon is extrapolated into the source's uncovered polar areas. The map's
precision is limited by its kilometer-scale base/control and interpretation.

Of 3,042 comparable label points, 2,918 agree and 124 differ; 870 additional
point labels describe crater ejecta excluded from the base-unit comparison.
These are openly recorded source-layer discrepancies, not a claim of complete
independent validation. Six distributed anchors and the exact raw source hashes
are tested. See
`src/planets/ganymede/source/science/geology-sim3237/registration-anchors.json`.

### Europa / Agenor

The exact selected file is
[`Agenor.tif`](https://astrogeo-ard.s3-us-west-2.amazonaws.com/jupiter/europa/galileo_voyager/usgs_controlled_dtms/Agenor/Agenor.tif),
168,472 bytes, SHA-256
`335c16fcb53c5e278f5660f3df5f42f58cd65d0ce78722c9a055ee2e7a053d62`.
It is a single-band Float32 COG, 642×133, with no-data
`−3.4028226550889045e38`, equirectangular center 180°E, planetocentric coordinates,
and a 1,560,800 m reference sphere. The exact upper-left map origin is
(−1236786.1079616144, −1146374.9999678) m and pixel increments are
(+614.0078951699215, −614.0078951699215) m. These are the actual reprojected COG
increments; neither the 450 m nominal source post spacing nor the roughly 3 km
effective resolution is substituted for them.

The DTM contains 39,032 finite, non-special values, from
−641.9267578125 to +218.51205444335938 m. A separate Pillow TIFF decode retained
seven original value/coordinate anchors in
`src/planets/europa/source/science/controlled-dtms/Agenor/value-anchors.json`.
The preparation decoder matches those original values with nearest sampling;
the actual bilinear display matches five interior anchors within 1e−8 m of
floating-point arithmetic and correctly withholds the two incomplete boundary
footprints. This numerical agreement is **not** source positional or height
accuracy.

The view keeps the original numeric values and source datum. It adds no offset,
does not subtract the body's radius, and does not combine independently
controlled regional DTMs. The display scale is −700…+300 m, with fixed northwest
cartographic relief and no vertical displacement or exaggeration of the globe.
The source documentation gives nominal vertical precision of 52 m and an
approximately 100 m empirical estimate for Agenor, neither a per-pixel quality
class nor a strict error bound. The controlled image frame differs from the
older 2010 mosaic; overlay-level image registration is not claimed.

The selected region is approximately 134.6–149.1°E and 42.1–45.1°S. Raster
georeferencing plus actual valid pixels owns the footprint; the STAC geometry
is not substituted as a precision mask. The body recipe specifies
`focus: {longitudeDegrees:142, latitudeDegrees:-43.7, zoom:4}`. Shared preparation
must turn that into existing lens camera navigation. On the current emitted
frame the solution is controlPitch 31.96379863908021°, controlYaw
−174.39749135400893°, zoom 4. The solid mesh's local X/Y swap is essential: use
the source-owned prime/east/north axes before the emitted system matrix. A
conventional unswapped vector would miss by about 91.71°. Runtime derives no
scientific geometry or geographic targeting.

The public release's FOM and `ClrConf` files are byte-identical for both inspected
sites (Agenor and Yelland). The original retained `provenance.txt` explicitly
translates `Agenor_FOM.vrt` into `Agenor_ClrConf.tif`; it also cubic-resamples
categorical FOM codes. Therefore **neither file supplies a trustworthy quality
classification**. They are retained only as excluded-source audit evidence.
The height COG itself supplies the finite/no-data mask; complete interpolation
footprints are required. No mask threshold or confidence label is inferred.
The S3 prefix contains only these processed products. The older paper's Figshare
link returned an empty response, and that paper says its earlier SOCET SET DTMs
were superseded by the controlled release. No incompatible older mask was joined.

## Integrity, restoration, and implementation

Io retains 3,527,147 bytes across 20 extracted raw members; Ganymede retains
3,196,292 bytes across 12. Small original GIS members are checked into their body
source directories. Their exact archive URLs, full central-directory inventories,
local member names, decompressed lengths, CRC32 and SHA-256 receipts are retained
beside them. Only selected byte ranges were downloaded; no whole-archive SHA-256
is claimed. Source interpretation is reproducible from those exact checked-in
members. The USGS releases are public-domain data with authors credited.

Europa retains the tiny new terrain inputs with explicit acquisition operations
for ignored TIFFs, hashes, the STAC item/collection snapshots, documentation and
processing logs. The release is [CC0-1.0](https://registry.opendata.aws/nasa-usgs-europa-dtms/).
The Yelland trial remains audit evidence; its ~0.44° longitude footprint is too
small to substitute for a useful new global lens at the current scene density.

`tools/objects/terrestrial-layers/categorical-geology.mjs` decodes the bounded
SHP/DBF/PRJ subset during preparation. Scanlines preserve holes and seam-split
polygons. Exact integer categories select authored colors; overlapping different
units become missing. The module rejects wrong CRS, altered population/bounds,
unknown attributes, unclosed rings, fractional categories, scalar transforms,
bilinear category sampling and terrain relief. Root owns its shared dispatch,
discrete legend integration and the geographic focus conversion.

Focused validation command:

```sh
node --test tools/objects/terrestrial-layers/categorical-geology.test.mjs tools/objects/terrestrial-layers/jovian-scientific-sources.test.mjs
```

Ten tests pass. All 145 source pins verify across Io (38), Europa (72), and
Ganymede (35), including the 48 restored inputs totaling 585,881,178 bytes.
Streaming restoration was restricted to the three body source trees. The
pre-download check found 251 GiB free disk and 82% system-wide memory free;
no decode, bake, capture, assembly or browser gate ran alongside restoration.
The Agenor recipe keeps bilinear source-height sampling and explicitly selects
nearest, lossless display packing, so atlas and pole reprojection cannot blend
the already qualified coverage boundary into missing cells.

Next qualification: shared integration tests, then one scheduled preparation
workload at a time. Retain source-versus-display
views for the geology maps and the Agenor crop, prove that selecting Agenor
actually reveals useful terrain at zoom 4, and run the agreed real-Chrome gates.
No object is declared ready by this intake document.
