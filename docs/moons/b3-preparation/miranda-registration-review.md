# Miranda historical geology registration review

The publisher page supports a bounded registration for an interpreted-geology lens. It does not establish new geodetic accuracy or terrain elevation. The installed registration maps normalized +East south-polar stereographic coordinates directly to the original GIS page XY. The archived WGS84/Orthographic declaration is incompatible with these page-sized numbers and is not used as moon geography.

Twelve equator/30-degree meridian intersections were read from the actual 675×737 publisher PNG. Six alternating points fit an affine transform; six interleaved points were withheld. Their maximum residual is **2.178 pixels**. The affine transform preserves the small rotation/shear visible in the published page, rather than assuming an exact circle. Polygon-to-preview registration uses four non-crater classes and reports its correlated edge errors separately.

Alonso (fresh-impact polygon 30), Gonzalo (21) and Stephano (3) were independently identified using the retained USGS 1988 named pictorial map, relative surrounding structure, and the actual geological preview. None enters either fit. Their Gazetteer comparisons are:

| Feature | Angular difference | Arc distance at 235.8 km radius |
|---|---:|---:|
| Alonso | 2.057° | 8.46 km |
| Gonzalo | 3.293° | 13.55 km |
| Stephano | 1.326° | 5.46 km |

These values bound the inspected registration; they are not uncertainties for every unit boundary. Only three crater identities were secure. Other names were not assigned to the nearest polygon. Preserve original mapped coverage, polygon holes, and unknown layer overlaps. Native source preview, GIS ZIP, Gazetteer JSON and USGS PDF have exact pins in `registration-proof.json`. The surface should be described as historical interpreted geological units with degree-scale registration limits, not measured composition or precise topography. No image bake or browser gate was run in this review.
