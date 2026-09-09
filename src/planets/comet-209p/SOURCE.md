# 209P/LINEAR: radar-constrained shape approximation

The single **Shape approximation** dataset uses 800 native raster triangles and the shared gray missing-imagery grid. Shadows defaults off. This is a smooth model of published dimensions, with no photographic texture or inferred local terrain.

## Source selection

| Candidate | Disposition |
| --- | --- |
| [Howell et al. (2014), dimensions reported by Schleicher & Knight (2016)](https://doi.org/10.3847/0004-6256/152/4/89) | Selected numeric dimensions; Section 2.2, radar dimensions 3.9 × 2.7 × 2.6 km; sections 1 and 3.2, 10.93 h lightcurve period. Original publication URL, byte count and SHA-256 are pinned in `source/reference/source-record.json`. Paper binaries are not redistributed. |
| [JPL radar publications](https://echo.jpl.nasa.gov/publications/pubs.html), PDS radar and Stooke shape releases | No downloadable original surface mesh for this nucleus identified in the surveyed releases. Mesh access remains unresolved. |
| Radar images or spectra | Constrain shape and rotation. Delay-Doppler images are not optical surface textures. No radar brightness is painted onto the model. |
| Optical and infrared observations cited in the selected paper | Constrain dimensions, period and activity; no resolved optical surface map selected. |

## Dimensions and limits

Section 2.2 reports **3.9 × 2.7 × 2.6 km** as full radar dimensions, citing Howell et al. (2014). The ellipsoid semiaxes are therefore 1.95, 1.35 and 1.30 km. The original DPS 2014 abstract 209.24 reports an earlier projected estimate of about 2.5 × 3 km and explicitly cautions that the images may not determine a detailed shape. This package uses the later three-axis values as reported by Schleicher & Knight (2016), not an independently retrieved radar mesh. Their optical lightcurve supports the 10.93-hour period; no pole solution or absolute rotational phase is claimed.

The model is centered on the analytic ellipsoid, with X along its longest semiaxis and Z along the shortest. The model axes have a fixed **illustrative** orientation (RA 0°, Dec 90°, meridian 0°), not a recovered inertial attitude. The same qualification appears beside the dataset. The opt-in Shadows bank illustrates illumination on this attitude, not a reconstruction of the radar encounter.

The camera reference radius is the cube root of the semiaxis product: 1.506967585 km. It only sets the package's length scale; the rendered geometry retains the three separate axes. The shared parameter loader's `published-semiaxes` convention converts kilometres directly to metres and rejects mixed thermal-radius inputs.

## Position and preparation

Original JPL Horizons elements and independent geometric vectors are checked in under `source/reference/`, including exact request URLs. They use heliocentric ICRF kilometres at JD 2461286.5 (3 September 2026 TT; the queried TDB difference is below 2 ms). The scene holds this epoch. The nearby ±30-day vectors test the existing conic approximation; it is not a long-term propagation or outgassing model.

A subdivided octahedron gives 2,048 source triangles. The shared meshoptimizer recipe reduces it to 800 within a 100 m preparation tolerance. Closed topology and sampled distance to the analytic ellipsoid are checked independently. This geometric approximation tolerance is not observational accuracy. All grid textures, normals, lighting banks, thumbnails, navigation images and bindings are prepared before runtime.

Restore the package inputs with `node tools/objects/dist/operations.js acquire comet-209p` and prepare with `node tools/objects/dist/prepare-authored.js comet-209p --write` after building astronomy/preparation and the shared solar geometry. The checked-in context PNG is regenerated and byte-checked by the existing radial snapshot recipe.

Qualification and delivery are recorded together in [the two-comet PR evidence](../../../docs/comets/ENCKE-LINEAR.md).
