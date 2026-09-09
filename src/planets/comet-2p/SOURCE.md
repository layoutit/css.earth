# 2P/Encke: radar-constrained shape approximation

The single **Shape approximation** dataset uses 800 native raster triangles and the shared gray missing-imagery grid. Shadows defaults off. This is a smooth model of published dimensions, with no photographic texture or inferred local terrain.

## Source selection

| Candidate | Disposition |
| --- | --- |
| [Harmon & Nolan (2005)](https://doi.org/10.1016/j.icarus.2005.01.012) | Selected numeric dimensions; Table 3: SAM1, P=11.1 h, a=4.58 km, axial ratio 2.60; section 4. Original publication URL, byte count and SHA-256 are pinned in `source/reference/source-record.json`. Paper binaries are not redistributed. |
| [JPL radar publications](https://echo.jpl.nasa.gov/publications/pubs.html), PDS radar and Stooke shape releases | No downloadable original surface mesh for this nucleus identified in the surveyed releases. Mesh access remains unresolved. |
| Radar images or spectra | Constrain shape and rotation. Delay-Doppler images are not optical surface textures. No radar brightness is painted onto the model. |
| Optical and infrared observations cited in the selected paper | Constrain dimensions, period and activity; no resolved optical surface map selected. |

## Dimensions and limits

Table 3 gives **a = 4.58 km** and **a/b = 2.60** for the 11.1-hour SAM1 case. Here a is a semiaxis, so the full length is 9.16 km and both short dimensions are 3.5230769 km. The paper also considers a/b = 2.04 and a slower SAM2 solution. The selected case gives the closest match to the reported infrared size, but does not establish a unique shape. Its projected-area effective radius is not a measured volume: this package uses the absolute model axes directly. No uniform spin is inferred from the dominant tumbling period.

The model is centered on the analytic ellipsoid, with X along its longest semiaxis and Z along the shortest. The model axes have a fixed **illustrative** orientation (RA 0°, Dec 90°, meridian 0°), not a recovered inertial attitude. The same qualification appears beside the dataset. The opt-in Shadows bank illustrates illumination on this attitude, not a reconstruction of the radar encounter.

The camera reference radius is the cube root of the semiaxis product: 2.422236697 km. It only sets the package's length scale; the rendered geometry retains the three separate axes. The shared parameter loader's `published-semiaxes` convention converts kilometres directly to metres and rejects mixed thermal-radius inputs.

## Position and preparation

Original JPL Horizons elements and independent geometric vectors are checked in under `source/reference/`, including exact request URLs. They use heliocentric ICRF kilometres at JD 2461286.5 (3 September 2026 TT; the queried TDB difference is below 2 ms). The scene holds this epoch. The nearby ±30-day vectors test the existing conic approximation; it is not a long-term propagation or outgassing model.

A subdivided octahedron gives 2,048 source triangles. The shared meshoptimizer recipe reduces it to 800 within a 100 m preparation tolerance. Closed topology and sampled distance to the analytic ellipsoid are checked independently. This geometric approximation tolerance is not observational accuracy. All grid textures, normals, lighting banks, thumbnails, navigation images and bindings are prepared before runtime.

Restore the package inputs with `node tools/objects/dist/operations.js acquire comet-2p` and prepare with `node tools/objects/dist/prepare-authored.js comet-2p --write` after building astronomy/preparation and the shared solar geometry. The checked-in context PNG is regenerated and byte-checked by the existing radial snapshot recipe.

Qualification and delivery are recorded together in [the two-comet PR evidence](../../../docs/comets/ENCKE-LINEAR.md).
