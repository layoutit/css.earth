# Thrymr source survey

## Selected shape

[Denk et al. (2018), Table 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) gives a minimum equatorial ratio of **1.21:1** under the uniform-reflectivity reference-ellipsoid interpretation of unresolved Cassini photometry. The [author’s Table 1C](https://tilmanndenk.de/outersaturnianmoons/thrymr/) gives a nominal reference radius of **3.8 km**, a rounded diameter estimate **8 (+2.25/−1.25) km**, and the reported rotation period **38.79 ± 0.25 h · tentative**.

Size assumes geometric albedo **0.06**. The author describes approximately −15/+30% sensitivity for albedo ±0.02 and H ±0.1 mag; the rounded range is not a measured Gaussian 1σ interval. The selected radius and rounded diameter are kept separately. No mass or density estimate is treated as measured.

The authored ellipsoid selects the published minimum ratio and assumes equal short axes. Its **derived display semi-axes** are **4.314931 × 3.566059 × 3.566059 km**. Equal-volume scaling to the 3.8 km reference radius is a display convention, not a measured volume. Formula and assumptions are in source/measurements.json; the checked 5° radius table is the reproducible source input.

Published period is tentative; do not show it as a secure current rotation prediction.

The approximation does not reproduce the observed lightcurve. No terrain, concavities, neck, separate component, or spatial albedo pattern is synthesized. The entire surface uses the standard missing-data grid. The context image is rendered from the same source mesh, simplifier and grid as the eventual surface.

## Source candidates and limits

- **Cassini ISS:** [PDS archive](https://pds-rings.seti.org/cassini/iss/) and the [individual observation page](https://tilmanndenk.de/outersaturnianmoons/thrymr/) supply unresolved photometry. It constrains brightness/elongation; no registered surface photograph is qualified.
- **Native inversion mesh:** [Denk et al. (2026), section 4.2](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf) reports calculated convex models with papers in preparation. No native Thrymr mesh is asserted by this authored approximation.
- **Terrain, colors, composition and binarity:** these checked sources do not qualify a mapped lens or components for this body. Integrated colors, where measured, are not painted onto the surface.
- **Provenance:** source/survey/research.json pins the checked paper/page receipts, exact designation and SAT456 identity. Scientific parameters are extracted with attribution; entire papers/pages are not redistributed under MIT.
- **Source reconciliation:** Individual page numeric period cell omits a question mark; retain tentative flag from Table 3 and discussion.
- **Source reconciliation:** Older 122-target overview nominal diameter 7.6 km differs from current Table 1C rounding/inputs. Adopt this row's body-page radius 3.8 km and retain quoted diameter range; do not mix them as precise measurements.

## Orientation and orbit

Physical pole, spin sense and current rotational phase remain unmeasured. The displayed motion does not fit the Cassini lightcurve.

The reported rotation period is an informational fact. The prepared scene uses a fixed arbitrary display phase and does not propagate physical spin. Display meridian is arbitrary. Reported period **38.79 ± 0.25 h · tentative** remains separate from a measured current attitude. Zero GM is unmodeled mass, not a measured zero.

JPL 630, Saturn XXX, **S/2000 S7**, resolves to **SAT456**. Mean elements establish identity and context. B1 orbital fitting and independent vector evidence are prepared separately; no borrowed fit, precision bound, current vector or extrapolation claim is made here. source/validation/orbit-checks.json will own the acquired reference epochs and measured fit residuals when produced.
