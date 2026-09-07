# Enceladus sources and preparation

Enceladus (NAIF 602) is a standalone moon of Saturn. Physical radius: 252.3 km
from the vendored JPL astronomy body record. The viewer uses a mean-radius
sphere; it does not render the measured triaxial outline or displaced relief.
The physical reference axes reported by Thomas et al. (2016) are 256.2, 251.4,
248.6 km. The largest spherical-outline discrepancy is about 1.6% in radius.

## Scientific surfaces

Both products are Schenk and McKinnon (2024), published in the USGS/PDS archive
on 2024-08-12. Credit NASA/JPL-Caltech/Space Science Institute, Paul M. Schenk,
William B. McKinnon, LPI/USRA. Archive access constraints: none; use constraint:
please cite authors. Original source hashes, byte sizes and URLs are in
`source/manifest.json`; original ISIS/PDS4 labels are retained beside the files.

- Monochrome: [controlled Cassini mosaic](https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-mosaic-100m-schenk).
  16098 × 8049 float pixels, 100 m archive grid, Cassini ISS CL1/CL2 clear filter.
  More than 500 registered images; native image detail varies. Preparation uses
  one linear display stretch, DN 0–16500 to 0–255, and bilinear geographic sampling.
  This is photographed brightness, not calibrated albedo. Source shadows and
  mosaic brightness differences remain. Shared globe Shadows provide approximate
  additional lighting and remain available.
- Elevation: [terrain model](https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-dem-200m-schenk).
  8049 × 4025 float pixels, 200 m archive grid. Values are **kilometres above
  the 256.2 × 251.4 × 248.6 km reference ellipsoid**, not heights above the
  256.2 km cartographic sphere. The display uses a blue–neutral–warm palette over −1 to +1 km,
  with zero at the neutral midpoint. The legend explicitly marks saturation at
  ≤−1 and ≥+1 km; underlying elevations are unchanged. About 98% of a uniform
  1024 × 512 valid raster sample lies inside that display range. Shading converts
  kilometre heights to metres, uses the source cartographic radius and
  latitude-dependent spacing, northwest light [-0.5, 0.5, √0.5], ambient 0.25,
  and no height exaggeration. The shared globe overlay adds curvature shading;
  Shadows switches it to directional illumination, as on Monochrome. This
  approximate overlay does not change the fixed terrain light direction. The
  legend shows unshaded height colors. This is a derived terrain model, not a
  direct height photograph.

Both GeoTIFFs are east-positive, planetocentric, equirectangular, center longitude
180°, standard parallel 0°, cartographic radius 256200 m. Their actual origins
are (-804900, 402500) m for imagery and (-805000, 402600) m for elevation. Native
origins and resolutions are validated and consumed, rather than assuming an
exact 2:1 source extent. Both prepare to 8192 × 4096: about 197 m per equatorial
map texel (193.5 m on the displayed mean-radius sphere). The model's 200 m grid
is slightly enlarged; this adds no detail. Runtime always uses this same bank,
independent of DPR. Surface and pole display atlases use WebP Q90, with
lossless alpha and unchanged dimensions. Source maps used for further preparation,
raw observations, numeric heights and legend scales retain their original precision.

The exact PDS missing constant is -3.40282265508890445e38. No-data, non-finite
values and ISIS float special values are excluded before display stretching.
Observed zero and other dark values remain valid. Missing observations receive
the shared gray grid, never inferred terrain. Bilinear image samples require all
four source neighbours; terrain shading does not fabricate missing neighbours.
The archive model is retained as published; its grid spacing is not a claim of
uniform observational resolution or uncertainty.

The archive has metadata inconsistencies: PDS prose interchanges the image/DEM
descriptions, and catalog observation dates precede Cassini's Saturn arrival.
The product-specific raster dimensions, pixel mapping and missing constants
agree between TIFF and labels. We do not reuse the inconsistent dates/descriptions.

[Paper: Schenk and McKinnon, Icarus 408, 115827](https://doi.org/10.1016/j.icarus.2023.115827).
[NASA facts](https://science.nasa.gov/saturn/moons/enceladus/) describe the icy
surface, global ocean, south-polar jets and 32.9-hour synchronous orbit.
No visible atmosphere, invented plume animation, or interior lens is supplied.

## Orientation and sky

Sun, orbit and body-fixed orientation are prepared at the shared epoch
2026-09-04T00:00:00 TT using JPL Enceladus parent-relative elements, VSOP87 Saturn
position and the IAU/WGCCRE Enceladus rotation. ESO/S. Brunier's panorama and
HYG v4.1 supply the shared astrometric sky. Their licenses and exact identities
are retained under `source/stars`. The shell title uses the pinned Inter font.

## Reproduce

```sh
node tools/objects/dist/operations.js acquire enceladus
node tools/objects/dist/operations.js verify enceladus
node tools/objects/dist/prepare-authored.js enceladus --write
```

Raw source TIFFs are reacquired for preparation, not delivered to the browser.
Prepared assets are local until an explicitly authorized publication step.
