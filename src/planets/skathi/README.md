# Skathi

## Sources

- [Denk et al. (2018), Table 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) gives a minimum equatorial ratio of **1.27:1** under the uniform-reflectivity reference-ellipsoid interpretation of unresolved Cassini photometry. The [author’s Table 1C](https://tilmanndenk.de/outersaturnianmoons/skathi/) gives a nominal reference radius of **3.8 km**, a rounded diameter estimate **8 (+2.25/−1.25) km**, and the reported rotation period **11.1 ± 0.02 h**.

## Evidence

- **Provenance:** [source/survey/research.json](source/survey/research.json) pins the checked paper/page receipts, exact designation and SAT456 identity.

- The radius table, neutral no-data image, title source and shape-derived context image are checked in.

## Known problems

- Size assumes geometric albedo **0.06**. The authored ellipsoid selects the published minimum ratio and assumes equal short axes.

- Skathi is legacy JPL Skadi, code 627; no body-fixed pole follows from this ratio.

- The approximation does not reproduce the observed lightcurve. The entire surface uses the standard missing-data grid.

- Physical pole, spin sense and current rotational phase remain unmeasured. The prepared scene uses a fixed arbitrary display phase and does not propagate physical spin.

- Orbital fitting is documented separately in [orbital checks](source/validation/orbit-checks.json); the B1 source-only account makes no precision, current-vector or extrapolation claim.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="skathi-source-survey"></a>

## Selected shape

The author describes approximately −15/+30% sensitivity for albedo ±0.02 and H ±0.1 mag; the rounded range is not a measured Gaussian 1σ interval. The selected radius and rounded diameter are kept separately. No mass or density estimate is treated as measured.

Its **derived display semi-axes** are **4.456420 × 3.508992 × 3.508992 km**. Equal-volume scaling to the 3.8 km reference radius is a display convention, not a measured volume. Formula and assumptions are in source/measurements.json; the checked 5° radius table is the reproducible source input.

No terrain, concavities, neck, separate component, or spatial albedo pattern is synthesized. The context image is rendered from the same source mesh, simplifier and grid as the eventual surface.

## Source candidates and limits

- **Cassini ISS:** [PDS archive](https://pds-rings.seti.org/cassini/iss/) and the [individual observation page](https://tilmanndenk.de/outersaturnianmoons/skathi/) supply unresolved photometry. It constrains brightness/elongation; no registered surface photograph is qualified.

- **Native inversion mesh:** [Denk et al. (2026), section 4.2](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf) reports calculated convex models with papers in preparation. No native Skathi mesh is asserted by this authored approximation.

- **Terrain, colors, composition and binarity:** these checked sources do not qualify a mapped lens or components for this body. Integrated colors, where measured, are not painted onto the surface.

- Scientific parameters are extracted with attribution; entire papers/pages are not redistributed under MIT.

- **Source reconciliation:** Older 122-target overview nominal diameter 7.3 km differs from current Table 1C rounding/inputs. Adopt this row's body-page radius 3.8 km and retain quoted diameter range; do not mix them as precise measurements.

## Orientation and orbit

The displayed motion does not fit the Cassini lightcurve.

The reported rotation period is an informational fact. Display meridian is arbitrary. Reported period **11.1 ± 0.02 h** remains separate from a measured current attitude. Zero GM is unmodeled mass, not a measured zero.

JPL 627, Saturn XXVII, **S/2000 S8**, resolves to **SAT456** under legacy spelling Skadi in the grouped ephemeris table. Mean elements establish identity and context.

The normal acquisition plan restores pinned ESO/font inputs.

The B1 source-only authoring script is [author-saturn-packages.mjs](../../../docs/moons/b1-preparation/author-saturn-packages.mjs). It copies no prepared scene or other body’s orbital validation.

</details>
