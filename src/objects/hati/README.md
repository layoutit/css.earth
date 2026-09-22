# Hati

## Sources

- [Denk et al. (2018), Table 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf) gives a minimum equatorial ratio of **1.42:1** under the uniform-reflectivity reference-ellipsoid interpretation of unresolved Cassini photometry. The [author’s Table 1C](https://tilmanndenk.de/outersaturnianmoons/hati/) gives a nominal reference radius of **2.4 km**, a rounded diameter estimate **5 (+1.5/−0.75) km**, and the reported rotation period **5.45 ± 0.04 h**.

## Evidence

- **Provenance:** [source/survey/research.json](source/survey/research.json) pins the checked paper/page receipts, exact designation and SAT456 identity.

- The radius table, neutral no-data image, title source and shape-derived context image are checked in.

## Known problems

- Size assumes geometric albedo **0.06**. The authored ellipsoid selects the published minimum ratio and assumes equal short axes.

- 5.45 ± 0.04 hours used from Table 3 and body page; overview wording 5.42 is inconsistent. Useful elongation floor.

- The approximation does not reproduce the observed lightcurve. The entire surface uses the standard missing-data grid.

- Physical pole, spin sense and current rotational phase remain unmeasured. The prepared scene uses a fixed arbitrary display phase and does not propagate physical spin.

- Orbital fitting is documented separately in [orbital checks](source/validation/orbit-checks.json); the B1 source-only account makes no precision, current-vector or extrapolation claim.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="hati-source-survey"></a>

## Selected shape

The author describes approximately −15/+30% sensitivity for albedo ±0.02 and H ±0.1 mag; the rounded range is not a measured Gaussian 1σ interval. The selected radius and rounded diameter are kept separately. No mass or density estimate is treated as measured.

Its **derived display semi-axes** are **3.032053 × 2.135249 × 2.135249 km**. Equal-volume scaling to the 2.4 km reference radius is a display convention, not a measured volume. Formula and assumptions are in source/measurements.json; the checked 5° radius table is the reproducible source input.

No terrain, concavities, neck, separate component, or spatial albedo pattern is synthesized. The context image is rendered from the same source mesh, simplifier and grid as the eventual surface.

## Investigation record

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json), including what would reopen each decision.

## Orientation and orbit

The displayed motion does not fit the Cassini lightcurve.

The reported rotation period is an informational fact. Display meridian is arbitrary. Reported period **5.45 ± 0.04 h** remains separate from a measured current attitude. Zero GM is unmodeled mass, not a measured zero.

JPL 643, Saturn XLIII, **S/2004 S14**, resolves to **SAT456**. Mean elements establish identity and context.

The normal acquisition plan restores the pinned font input.

The B1 source-only authoring script is [author-saturn-packages.mjs](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b1-preparation/author-saturn-packages.mjs). It copies no prepared scene or other body’s orbital validation.

</details>
