# Ceres sources

`source/manifest.json` pins acquisition URLs, byte counts, checksums, credits,
and consumers. Originals are acquired from their publishers, not other objects.

| Input | Source and use |
| --- | --- |
| Monochrome | [USGS Dawn FC global mosaic, 140 m/pixel](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_140m), sampled through WMS at 4096 × 2048 over 0–360° east, 90°N–90°S. Visible-light grayscale, not an unlit albedo map. |
| Enhanced color | [NASA PIA19977](https://science.nasa.gov/resource/hints-at-ceres-composition-from-color/), 3078 × 1537. False color from 920, 750, and 440 nm filters. South-polar gaps use a neutral gray cartographic grid. |
| Sky | [ESO/S. Brunier panorama](https://www.eso.org/public/images/eso0932a/) and the checked HYG field snapshot, projected through the shared astrometric sky preparer. |
| Title | Pinned Inter variable font; shared title outline preparation. |
| Physical/orbit data | Vendored `@cssearth/astronomy` JPL body data, Kepler state vectors and IAU rotation. Mean radius 469.7 km; fixed geometry epoch 2026-09-04T00:00:00 TT. |
| Facts | [NASA Ceres facts](https://science.nasa.gov/dwarf-planets/ceres/facts/), summarized in `tools/prepare-content.mjs`: asteroid-belt location, Dawn observations, about nine hours per rotation, no moons. |

The maps share a global equirectangular grid. Their large craters align visually;
this is not a surveyed co-registration. Published shadows and seams are retained. As with Pluto, exactly black pixels
connected to the southern source border are identified before interpolation.
The shared preparation helper marks those gaps with a neutral gray grid; it
does not infer terrain. Enclosed black terrain and nonzero JPEG edge pixels
remain untouched, so a dark edge fringe can remain.

Coverage decision: both pinned rasters have three color channels and no alpha
or accompanying validity mask. Southern-edge-connected exact black is used as
a conservative indication of fill in each of these map images. This is a
heuristic, not a surveyed coverage boundary. In particular, JPEG compression can
make fill pixels nonzero. We preserve those uncertain pixels instead of raising
a brightness threshold that could erase observed dark terrain. The shared grid
defines the presentation, not scientific validity for every dataset.

Preparation creates 452 retained surface leaves, polar textures, a lighting
atlas, sky faces, and the shared heliocentric presentation. The mesh uses a
spherical mean radius; no resolved Ceres shape or elevation model is claimed.
The runtime only loads prepared assets and publishes shared view state.

Surface bands are reprojected for their projective trapezoids before packing;
linear image latitude cannot be stretched directly over projective UVs. Polar
textures use the cap geometry and hemisphere-specific longitude direction.
Both use bilinear source sampling and lossless encoding. Original source files remain unchanged. Prepared maps mark only the identified
gaps; the runtime lighting is a separate prepared overlay.
The shared perspective camera converts PolyCSS geometry to world units without
an extra zoom multiplier. Lighting fits that same projected radius, and its
prepared disc stays within the atlas frame. The low-polygon surface still has
small geometric facets; the overlay does not represent an atmosphere.

Lighting decision: retain the published Dawn observations, including their
original crater shadows. The optional Shadows setting adds approximate
directional illumination of the spherical model. With Shadows off, a fixed
curvature overlay gives the globe depth. Neither mode reconstructs unlit albedo
or physically relights the photographed crater shadows. This limitation is
explained in both lens descriptions.

## Elevation lens

The [DLR/USGS Dawn HAMO DTM](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m)
contains 21,600 × 10,800 signed 16-bit samples at 60 pixels/degree. Values are
meters above a 470 km sphere, including the body's overall shape; they are not
heights above a fitted ellipsoid. The GeoTIFF is centered on 180°E and its left
edge is 0°E. No-data is −32768. Preparation samples the published model without
filling missing values and maps heights to a fixed −30 to +20 km color scale.

The publisher describes approximately 98% surface coverage and interpolation
in permanently shadowed polar areas, but supplies no validity mask separating
interpolation from stereo samples. To avoid showing that fill as observed
terrain, the lens withholds both caps at |latitude| ≥60°. This is our conservative
display boundary, not the source's observation boundary. The shared gray grid
marks withheld or missing samples; no terrain is invented.

Preparation also derives terrain shading from neighboring model heights at the
delivered 4096 × 2048 grid spacing. Central differences account for Ceres's
470 km radius and longitude spacing at each latitude. Fixed northwest light at
45° altitude and 25% ambient light reveal slopes without height exaggeration.
Level terrain retains its base color; shading changes brightness, so the legend
shows the unshaded height scale. Samples beside missing or withheld neighbors
keep their base color; neither heights nor coverage are interpolated to shade gaps.

The map and its numeric legend are prepared together. The surface uses
the existing Ceres band/pole projection. Generic prepared material selection
disables lighting for Elevation, even when Shadows is on, and restores lighting
when returning to a photographic lens. No runtime controller or runtime
scientific-data parser is added.
