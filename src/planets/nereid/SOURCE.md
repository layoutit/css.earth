# Nereid source survey

Status: size-model presentation implemented; photographic surface mapping is unqualified.

## Physical interpretation

- Target: Neptune II, NAIF 802; parent Neptune, NAIF 899.
- [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) list a mean radius of 170 ± 25 km. The zero GM field is an unmodeled mass, not a claim of zero physical mass.
- [Kiss et al. (2016)](https://arxiv.org/abs/1601.02395) derive a thermal-model diameter of 345 ± 15 km. This is consistent with the older size estimate but is not a measured three-dimensional shape or a terrain map.
- The [NASA PIA00054 caption](https://science.nasa.gov/resource/nereid/) calls 170 km the distance across. That conflicts with the radius in JPL's table and the research diameter. Do not copy the caption's size into geometry.
- Detailed shape, surface-coordinate registration and current orientation remain unqualified. The included sphere is explicitly described as a size approximation.

## Image and dataset survey

- [Voyager ISS/PDS](https://pds-rings.seti.org/voyager/iss/): 325 catalog matches, first 12 retained in `source/survey/opus.json`. Both the finest C1137631 (43.27 km/pixel, 96.12° phase) and lower-phase C1129120 (62.09 km/pixel, 55.74° phase) calibrated native frames were inspected. Their discs span roughly eight and five pixels. Photographed illumination and sampling dominate; their pole/landmark registration is unqualified. No photographic lens is included. Exact inspected product hashes and original labels are retained in `source/survey`.
- [Kiss et al. (2016)](https://academic.oup.com/mnras/article/457/3/2908/2588900): K2 rotation, Spitzer/Herschel thermal photometry and model-derived shape constraints add physical context. They do not provide a spatial DEM, thermal map or composition map. The study explicitly says the Voyager data do not constrain the detailed shape. Its roughness inference is not rendered as invented craters.
- [JPL texture inventory](https://space.jpl.nasa.gov/tmaps/neptune.html) supplies no Nereid surface map. No registered terrain product was qualified from the inspected mapping releases or their cited work. Future image registration remains possible research, not a claim that photographs do not exist.

## Included model and shared behavior

The Shape model dataset shows a spherical **size approximation** from JPL's mean radius, not a measured spherical shape. The entire surface uses the ordinary shared missing-data grid. The active lens visibly discloses the approximation and absent mapping. No terrain, albedo, rings or atmosphere are invented.

The radius table is reproducible with `r(lon, lat) = meanRadiusKm` on the checked-in 5° grid. Meshoptimizer produces 480 native triangle leaves, below the 2,000-leaf budget. Its geometric simplification tolerance is not measurement uncertainty. Shared Flood lighting is the default; directional Shadows remains available. Minimap, thumbnail and context billboard derive from the same model.

The display pole uses the fitted orbital normal with an arbitrary meridian. This is an illustration convention, not a measured spin pole, synchronous rotation or current landmark phase. Orbital position is separately fitted from JPL Horizons over 2020–2032; the six independent fractional-day vectors in the astronomy fixtures measure residuals rather than a universal accuracy bound. Extrapolation outside that interval is not qualified.

Source inputs and authored documents are pinned in `source/manifest.json`. External preparation inputs are restored by `preparation/acquisition.json`. Archive images surveyed but not used to bake assets are recorded as evidence rather than required runtime downloads.

At the six committed reference epochs, the maximum position residual is 10,417 km. This is about 0.19% of the fitted semimajor axis.
