# Radar asteroid continuation

Six additional published shape models extend the registry from 84 to 90 asteroids. Original meshes come from the [NASA/JPL shape archive](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html); each package records its associated research and the limits of that reconstruction.

| Number | Body and source record | Source triangles | Prepared triangles | Reference radius (km) |
| --- | --- | ---: | ---: | ---: |
| 8567 | [1996 HW1](../src/planets/asteroid-1996-hw1/SOURCE.md) | 2,780 | 800 | 1.01 |
| 341843 | [2008 EV5](../src/planets/asteroid-2008-ev5/SOURCE.md) | 3,996 | 800 | 0.2 |
| 2100 | [Ra-Shalom](../src/planets/ra-shalom/SOURCE.md) | 2,292 | 800 | 1.15 |
| 10115 | [1992 SK](../src/planets/asteroid-1992-sk/SOURCE.md) | 1,016 | 800 | 0.5 |
| 52760 | [1998 ML14](../src/planets/asteroid-1998-ml14/SOURCE.md) | 1,020 | 800 | 0.5 |
| 276049 | [2002 CE26 Primary](../src/planets/asteroid-2002-ce26/SOURCE.md) | 2,292 | 800 | 1.73 |

Original vertices retain their published kilometer scale. Reference radii define display scale and the Elevation datum; they do not resize the source geometry. The existing source-meshoptimizer preparation preserves source connectivity and prepares 800 native PolyCSS u raster triangles per body with 128 px cells. The shared grid marks unavailable registered optical imagery. Shadows start off and remain optional.

Shape shows the published reconstruction. Elevation transfers source-surface radius minus the reference sphere through the established closest-source-point method. It includes global shape and is not an independent topographic measurement or gravitational height. Ambiguous or out-of-allowance correspondences retain the grid. Sampled fit distances and library error estimates are separate measurements; neither is an exhaustive bound.

1996 HW1 retains its contact-binary neck. Its concavities require original mesh connectivity; a single radius per direction would select the wrong surface in some directions. 2008 EV5 retains the broad equatorial ridge and concavity described by the radar study.

Ra-Shalom and 1992 SK retain the archived models' own orientation conventions, with later conflicting spin solutions disclosed. The display axes remain registered to the archived mesh. ML14 uses its historical 1998 radar geometry with fixed arbitrary display orientation because that study did not determine a pole. Its later photometric period is informational, and optional directional lighting is explicitly illustrative. CE26 displays only the documented primary reconstruction; its weakly constrained north polar region and approximate pole remain visible qualifications.

All six use the generic object package and shared Solar System navigation. Their heliocentric conics use the existing JD 2461286.5 epoch and are checked against independent Horizons vectors 30 days either side. These are fixed-epoch display fits, not long-term perturbation ephemerides.
