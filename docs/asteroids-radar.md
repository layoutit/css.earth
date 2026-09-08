# Radar asteroid expansion

Six archived NASA/JPL radar models extend the registry from 78 to 84 asteroids. The [JPL model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) supplies the original meshes; the associated research supplies scale, spin and model qualifications. This is a bounded addition, not a complete census of asteroids or radar datasets.

| Number | Body and source notes | Original triangles | Prepared triangles | Reference radius (km) |
| --- | --- | ---: | ---: | ---: |
| 1620 | [Geographos](../src/planets/geographos/SOURCE.md) | 4,092 | 800 | 1.284042 |
| 2063 | [Bacchus](../src/planets/bacchus/SOURCE.md) | 508 | 508 | 0.315 |
| 4486 | [Mithra](../src/planets/mithra/SOURCE.md) | 5,996 | 800 | 0.845 |
| 4660 | [Nereus](../src/planets/nereus/SOURCE.md) | 2,292 | 800 | 0.165 |
| 6489 | [Golevka](../src/planets/golevka/SOURCE.md) | 4,092 | 800 | 0.265 |
| 54509 | [YORP](../src/planets/yorp/SOURCE.md) | 572 | 572 | 0.0564 |

Original coordinates retain their kilometer scale. Reference radii supply display and scalar datums; they do not rescale the meshes. Geographos uses the volume-equivalent radius calculated from the selected archive geometry. The other five use the equivalent diameter associated with their published model.

The established meshoptimizer source-connectivity path reduces the four denser meshes. Bacchus and YORP retain their original triangles. Every body uses native PolyCSS `u` primitives in raster mode, 128 px cells, prepared lighting and the shared missing-imagery grid. Both device densities use the same highest-density asset bank. No new renderer or runtime geometry path is introduced.

## Scientific views

Each body has Shape and Elevation. No registered optical surface map was identified in the bounded source survey, so Shape retains the normal grid. Radar images, optical light curves and paper figures are not treated as geographic reflectance maps.

Elevation is source-model radius minus the documented reference sphere. The existing closest-source-point transfer evaluates this scalar on the full original mesh. Ambiguous or distant correspondences retain missing-data coverage; the flat longitude/latitude preview also withholds ambiguous rays. This is a second visualization of the shape model, not independent measured topography or gravitational height.

Source and reduced meshes were compared from front, back and both poles. Independent nearest-triangle samples use 8,192 points in each direction. Those sampled distances and meshoptimizer estimates are not exhaustive geometric bounds or observational uncertainties. Per-body notes retain the measurements, transfer allowances and source-derived scalar anchors.

The selected reconstructions are explicitly qualified: Geographos has unresolved north–south structure and later alternative interpretations; Bacchus uses the conservative single-lobe working model; Mithra retains the named prograde solution with its mirrored alternative disclosed; Nereus retains the preferred smaller-volume geometry despite its archival `alt1` filename. YORP holds the published 2001 reference rotation rate fixed and does not extrapolate its measured spin acceleration. Display meridians remain arbitrary.

## Orbits

JPL Horizons geometric heliocentric ICRF elements use JD 2461286.5. Independent vectors at that epoch and 30 days either side qualify the fixed-epoch conics. All six reproduce the fitted epoch within 1 mm. The largest endpoint differences are approximately 1,944.05 km for Geographos, 175.07 km for Bacchus, 243.37 km for Mithra, 132.45 km for Nereus, 707.11 km for Golevka and 307.55 km for YORP. The existing regression test records individual upward-rounded bounds; these fits are not long-term perturbation ephemerides. Horizons provides no GM for these records, so none is inferred from an assumed density.

The shared Solar System context and asteroid accordion include all six. The main-branch asteroid-orbit setting remains off by default.

## Validation

Final browser and delivery results will be recorded after integration checks finish.
