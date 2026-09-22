# Nereid

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) list a mean radius of 170 ± 25 km.

- [Kiss et al. (2016)](https://doi.org/10.1093/mnras/stw081), equation 4, use the triaxial family `a=(1+X)b`, `c=(1−X)b`, rotating about the shortest axis. Their combined light-curve and thermal modelling favors `X≈0.13`; the selected feasible example uses `X=0.133`, or long/short≈1.3.

## Evidence

- Both the finest C1137631 (43.27 km/pixel, 96.12° phase) and lower-phase C1129120 (62.09 km/pixel, 55.74° phase) calibrated native frames were inspected. Exact inspected product hashes and original labels are retained in [source/survey](source/survey).

- Orbital position is separately fitted from JPL Horizons over 2020–2032; the six independent fractional-day vectors in the astronomy fixtures measure residuals rather than a universal accuracy bound. At those six reference epochs, the maximum position residual is 10,417 km, about 0.19% of the fitted semimajor axis.

## Known problems

- Status: approximate ellipsoid from published modelling; photographic surface mapping is unqualified. The equal-volume scaling is an explicit display convention, not three measured dimensions.

- This is one model orientation, not a uniquely measured pole or current landmark phase.

- Photographed illumination and sampling dominate; their pole/landmark registration is unqualified. No photographic lens is included.

- Extrapolation outside that interval is not qualified.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="nereid-source-survey"></a>

## Physical interpretation

- Target: Neptune II, NAIF 802; parent Neptune, NAIF 899.

- The zero GM field is an unmodeled mass, not a claim of zero physical mass.

- This constrains a useful approximation, not a unique measured mesh.

- The display uses that published `X=0.133` family. We normalize its volume to the existing JPL nominal 170 km radius, giving derived semiaxes **193.76 × 171.01 × 148.27 km**. The paper's thermal effective diameters of 335–345 km support a similar overall scale but are not silently treated as volume diameters.

- The representative pole is the paper's Figure 8 model at ecliptic longitude 320°, latitude 32°. It is converted to equatorial coordinates using J2000 obliquity (RA312.4211°, Dec 15.6260°); the zero meridian remains arbitrary.

- Figure 8's manuscript caption says `X=0.0133`, inconsistent with equation 4 and the repeated `X=0.133` discussion in sections 2.3, 3.4 and 4. The recipe uses the explicitly selected model in the text; this discrepancy is preserved in `source/survey/kiss2016-model.json`.

- The [NASA PIA00054 caption](https://science.nasa.gov/resource/nereid/) calls 170 km the distance across. That conflicts with the radius in JPL's table and the research diameter. Do not copy the caption's size into geometry.

## Investigation ledger

The source-survey dispositions and evidence are recorded in the [investigation ledger](investigations.json).
## Included model and shared behavior

The Shape model dataset shows the **approximate ellipsoid** above, with its model origin and non-unique shape/pole visible beside the active lens. The entire surface uses the ordinary shared missing-data grid. No terrain, albedo, rings or atmosphere are invented. Thermal roughness does not supply crater locations, so none are synthesized.

The 5° radius table follows `r(lon,lat)=1/sqrt((cos(lat)cos(lon)/a)²+(cos(lat)sin(lon)/b)²+(sin(lat)/c)²)`. Its exact axes, family and scaling formula are in `source/measurements.json`. The shared meshoptimizer recipe targets 480 native triangle leaves with a 2,000-leaf maximum. Simplification tolerance is separate from physical model uncertainty. Shared Flood lighting is the default; directional Shadows remains available. Minimap, thumbnail and context billboard must be regenerated from this same approximation.

Source inputs and authored documents are pinned in `source/manifest.json`. External preparation inputs are restored by `preparation/acquisition.json`. Archive images surveyed but not used to bake assets are recorded as evidence rather than required runtime downloads.

</details>
