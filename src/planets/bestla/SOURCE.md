# Bestla source survey

## Selected shape

[Denk et al. (2018), Table 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) gives a minimum equatorial ratio of **1.47:1** under the uniform-reflectivity reference-ellipsoid interpretation of unresolved Cassini photometry. The [author’s Table 1C](https://tilmanndenk.de/outersaturnianmoons/bestla/) gives a nominal reference radius of **3.3 km**, a rounded diameter estimate **7 (+2/−1.25) km**, and the reported rotation period **14.6238 ± 0.0001 h**.

Size assumes geometric albedo **0.06**. The author describes approximately −15/+30% sensitivity for albedo ±0.02 and H ±0.1 mag; the rounded range is not a measured Gaussian 1σ interval. The selected radius and rounded diameter are kept separately. No mass or density estimate is treated as measured.

The authored ellipsoid selects the published minimum ratio and assumes equal short axes. Its **derived display semi-axes** are **4.266373 × 2.902295 × 2.902295 km**. Equal-volume scaling to the 3.3 km reference radius is a display convention, not a measured volume. Formula and assumptions are in source/measurements.json; the checked 5° radius table is the reproducible source input.

Published south-ecliptic pole latitude approximately -85 ± 15 degrees and sidereal period are useful; do not invent a pole longitude or native convex mesh.

The approximation does not reproduce the observed lightcurve. No terrain, concavities, neck, separate component, or spatial albedo pattern is synthesized. The entire surface uses the standard missing-data grid. The context image is rendered from the same source mesh, simplifier and grid as the eventual surface.

## Source candidates and limits

- **Cassini ISS:** [PDS archive](https://pds-rings.seti.org/cassini/iss/) and the [individual observation page](https://tilmanndenk.de/outersaturnianmoons/bestla/) supply unresolved photometry. It constrains brightness/elongation; no registered surface photograph is qualified.
- **Native inversion mesh:** [Denk et al. (2026), section 4.2](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf) reports calculated convex models with papers in preparation. No native Bestla mesh is asserted by this authored approximation.
- **Terrain, colors, composition and binarity:** these checked sources do not qualify a mapped lens or components for this body. Integrated colors, where measured, are not painted onto the surface.
- **Provenance:** source/survey/research.json pins the checked paper/page receipts, exact designation and SAT456 identity. Scientific parameters are extracted with attribution; entire papers/pages are not redistributed under MIT.
- **Source reconciliation:** Individual page lists pole unknown; primary 2018 §3.2(l) gives beta=-85 ±15 deg and retrograde spin. Use the partial primary constraint; do not invent pole longitude.
- **Source reconciliation:** Older 122-target overview nominal diameter 6.7 km differs from current Table 1C rounding/inputs. Adopt this row's body-page radius 3.3 km and retain quoted diameter range; do not mix them as precise measurements.

## Orientation and orbit

Partial observed south-ecliptic pole latitude and retrograde sense are preserved. Exact pole longitude and current phase remain unknown; ecliptic south is a representative display convention, not the full measured pole. Author body-page pole cells are blank; the primary paper supplies this partial constraint.

The reported rotation period is an informational fact. The prepared scene uses a fixed arbitrary display phase and does not propagate physical spin. Display meridian is arbitrary. Reported period **14.6238 ± 0.0001 h** remains separate from a measured current attitude. Zero GM is unmodeled mass, not a measured zero.

JPL 639, Saturn XXXIX, **S/2004 S18**, resolves to **SAT456**. Mean elements establish identity and context. B1 orbital fitting and independent vector evidence are prepared separately; no borrowed fit, precision bound, current vector or extrapolation claim is made here. source/validation/orbit-checks.json will own the acquired reference epochs and measured fit residuals when produced.
