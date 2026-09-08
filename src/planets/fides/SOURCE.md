# Fides sources and preparation

## Selected model

[Original DAMIT model 311](https://damit.cuni.cz/projects/damit/asteroid_models/view/311), version 2011-04-21, is a calibrated convex reconstruction. The model page explicitly marks calibrated size = yes; DAMIT documentation defines these coordinates in kilometers. The original model page, metadata, referenced bibliographic records, frame documentation and available IAUspin file are checked in and pinned. The saved HTML is evidence only; its viewer scripts are never evaluated or included at runtime.

[Original counted triangle table](https://damit.cuni.cz/projects/damit/stored_files/open/1135/shape.txt) has 1009 vertices and 2014 triangles. It is consumed without conversion by the existing PDS plate-table reader because its count/XYZ/one-based-triangle layout is identical. This is a DAMIT dataset, not a PDS release. Its vertices, outward winding and co-rotating frame remain unchanged. Positive Z is the spin pole and positive X defines the meridian.

The record gives diameter 118 km, period 7.332527 h and ecliptic J2000 pole (270°, 19°). The original mesh has measured volume-equivalent radius 59.000006 km and Cartesian extents 136.719 × 129.356 × 109.326 km. The rounded catalog diameter is used as the reference-sphere scale; the original coordinates are not rescaled.


## Appearance and preparation

Shape uses the shared missing-imagery grid. DAMIT's viewer illustrations are not source surface maps; no albedo, photographic color, regolith or composition is inferred. Elevation shows the radius of the original model minus a 59 km sphere, on a -10 to 20 km legend. This is a second display of the same reconstruction, not an independent measurement or height above a gravitational equipotential. A 4096 × 2048 display map does not add observational detail. The existing scientific recipe samples 721 × 361 directions, then applies its documented cartographic relief.

The existing source-meshoptimizer recipe reduces the original connected surface to 800 triangles. Meshoptimizer 1.2.0 reports 359.4 m estimated error, below the authored 400 m stopping threshold; this estimate is not a Hausdorff bound. All models use 800 native PolyCSS u raster leaves, 128 × 128 px per leaf in a 2048 × 6400 atlas, with lighting and texels prepared ahead of runtime. The surface remains one closed component with Euler characteristic 2.

Independent 8192 area-stratified samples in each direction measured nearest-triangle distances: p95 105.154 m, maximum 359.325 m. These are sampled distances, not exhaustive geometric bounds. All source face centroids and 8192 sphere directions were checked for radial ambiguity; no second radial intersection was found. Source/reduced snapshots cover front, back and both poles, each normalized to its own maximum radius; they are geometry inspection, not browser pixel parity.

## Frame, source closure and delivery

The source ecliptic J2000 pole is converted with obliquity 23.439291111° for the existing observed-pole recipe. Prime-meridian display phase is explicitly arbitrary; the available IAUspin file is preserved but no absolute rotational ephemeris is claimed.

Pinned JPL Horizons elements and independent vectors at JD 2461286.5 and ±30 days supply heliocentric ICRF context. The conic is a fixed-epoch display approximation, not a long-term perturbation ephemeris. TDB is approximated as TT within 2 ms. GM is the value in the pinned Horizons physical block, or zero for an unavailable GM; it is not inferred from an assumed density.

source/manifest.json pins every consumed file. The original mesh is checked in and also restorable through source/preparation/acquisition.json, along with the ESO panorama and Inter font. Original model-record snapshots and supporting documents remain checked in because server-generated HTML contains changing timestamps. The pinned context PNG is reproduced by the existing radial snapshot recipe. The authored object preparer rebuilds the package; runtime setup installs only published prepared assets.
