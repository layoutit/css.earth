# Himalia source survey

Status: size-model presentation implemented; photographic surface mapping is unqualified.

## Physical interpretation

- Target: Jupiter VI, NAIF 506; parent Jupiter, NAIF 599.
- [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) list a mean radius of 85 ± 10 km and GM of 0.15155 ± 0.05763 km³/s². Retain the uncertainty; do not infer a precisely measured mass or density.
- [NASA's Cassini observation](https://science.nasa.gov/resource/distant-himalia/) was acquired on 2000-12-19 at about 27 km/pixel. The approximately 160 km apparent height is a projected extent, not a complete three-dimensional shape solution. The published inset is enlarged tenfold.
- [The 2018 occultation report](https://meetingorganizer.copernicus.org/EPSC-DPS2019/EPSC-DPS2019-1909-1.pdf) constrains an elliptical projected outline larger than the Cassini estimate. Resolve its final analysis and coordinate definitions before choosing geometry; a projected ellipse does not determine the unseen third axis.
- Pole, rotational phase and complete shape remain unqualified. Do not fill missing axes by silently copying an observed axis.

## Image and dataset survey

- [Cassini ISS/PDS](https://pds-rings.seti.org/cassini/iss/): 93 catalog matches, first 12 retained in `source/survey/opus.json`. The finest-distance N1355869401 calibrated native frame was inspected: CL1/CB3, 8.2-second exposure, approximately 26.60 km/pixel. This long exposure is not a securely registered disc; camera pointing, limb interpretation and the unknown 3D shape remain unresolved. Exact raster hash and original label are retained.
- [Denk et al. (2026), section 4.3.3 and Figure 20](https://refubium.fu-berlin.de/bitstream/handle/fub188/51747/11214_2026_Article_1263.pdf?sequence=1) analyzes Cassini's shorter exposures in seven filters: approximately 4–6 pixels span the disc, without unambiguous surface spots. Color photometry is integrated context, not a defensible spatial color/composition lens. The same review finds New Horizons' 2007 images barely resolved. Neither supplies a qualified terrain map for this package.
- The 2018 occultation constrains a projected ellipse. It does not determine the third axis or a unique pole, so this package does not invent an elongated 3D shape from it. No registered DEM or mapped geology release was qualified.

## Included model and shared behavior

The Shape model dataset shows a spherical **size approximation** from JPL's mean radius, not a measured spherical shape. The entire surface uses the ordinary shared missing-data grid. The active lens visibly discloses the approximation and absent mapping. No terrain, albedo, rings or atmosphere are invented.

The radius table is reproducible with `r(lon, lat) = meanRadiusKm` on the checked-in 5° grid. Meshoptimizer produces 480 native triangle leaves, below the 2,000-leaf budget. Its geometric simplification tolerance is not measurement uncertainty. Shared Flood lighting is the default; directional Shadows remains available. Minimap, thumbnail and context billboard derive from the same model.

The display pole uses the fitted orbital normal with an arbitrary meridian. This is an illustration convention, not a measured spin pole, synchronous rotation or current landmark phase. Orbital position is separately fitted from JPL Horizons over 2020–2032; the six independent fractional-day vectors in the astronomy fixtures measure residuals rather than a universal accuracy bound. Extrapolation outside that interval is not qualified.

Source inputs and authored documents are pinned in `source/manifest.json`. External preparation inputs are restored by `preparation/acquisition.json`. Archive images surveyed but not used to bake assets are recorded as evidence rather than required runtime downloads.

At the six committed reference epochs, the maximum position residual is 645,824 km. This is about 5.6% of the fitted semimajor axis: a coarse orbit preview, not precision tracking. The existing prepared slow-longitude correction reduces the error but does not represent all solar perturbations.
