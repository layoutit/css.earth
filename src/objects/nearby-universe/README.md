# Nearby Universe galaxy field

A sparse view of galaxies between 3 and 200 Mpc. The 1,800 points preserve
catalogue positions; 160 faint clouds show concentrations of catalogue entries.
The clouds are **not gas or measured mass density**. Colors, exposure and
sampling are authored display choices; no measured luminosities are imported.

## Sources

| Source | Measurement used |
| --- | --- |
| [Cosmicflows-4 — Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) | Table 2: 55,877 galaxy identities, J2000 coordinates and individual distance moduli. |
| [HyperLEDA I — Paturel et al. (2003)](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/237) | PGC identities, J2000 coordinates, morphology and angular diameter; retain the largest 50,000 by diameter. |
| [HyperLEDA II — Paturel et al. (2003)](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/238) | Positive HI radial velocities for fallback distance estimates. |

[Manifest](source/manifest.json) binds the downloaded bytes and authored
records to canonical published sources. [Acquisition pins](source/catalogue.json)
retain exact ADQL queries, URLs, row counts and hashes. These are CDS-distributed
catalogue inputs, not a borrowed application catalogue. Original source terms
apply; no blanket redistribution license is established. Downloads stay ignored.
See the [investigation ledger](investigations.json) for selected and rejected work.

## Evidence

The [contract conversion comparison](evidence/contract-reproduction.json)
records exact equality of frame, point and cloud data against PR #215's initial
commit. A prior cold-cache acquisition reproduced the two runtime assets
byte-for-byte; it is an acquisition/reproduction check, not scientific acceptance.

[Context provenance tests](../../../tools/context-provenance.test.mts) verify
output and inventory pins and reject changed bytes.
[Catalogue tests](../../../tools/galaxy-field/catalogue.test.mts) check distance
modulus scale and Cartesian axes. Runtime setup tests exercise installation,
verified reuse, manifest mirrors and unsafe paths. The renderer uses 170 field
elements; that bound does not prove a frame rate.

## Known problems

The display is neither a complete galaxy survey nor a map of the observable
universe. Selection effects and gaps cannot establish cosmic voids. Hubble-law
fallback distances have no peculiar-velocity correction; uncertainty is not
shown. Morphology colors are illustrative. No calibrated brightness or mass
interpretation, native-image fidelity or measured performance claim is made.

<details>
<summary>Preparation and delivery</summary>

The [recipe](source/preparation/field.json) owns sampling, covariance fitting and
texture settings. Preparation joins PGC identities, uses `10^((DM−25)/5)` Mpc
when a CF4 modulus exists, and otherwise positive `VHI/H0`, with H0 declared in
the recipe. Coordinates are equatorial Cartesian axes in `sun-icrf`; the shared
navigation epoch tags static context and does not imply a measurement epoch.

The standard descriptor binds the prepared field hash. Generated provenance
uses the shared object-lineage schema. Identical root and prepared runtime
inventories list every delivered field and presentation asset. Shared setup
can install this resource explicitly; the bake restores it from scientific
inputs without requiring published runtime mirrors. Source publication and
runtime publication are different operations.

See the [shared setup guide](../../../README.md) for installation.

`prepare:galaxy-field` acquires sources, bakes assets and regenerates provenance
and source usage. Production builds use the same preparation. Generated images
and source downloads are ignored. No additional scene or camera is mounted.

</details>

Each sampled point retains its PGC identity and distance method. Cosmicflows-4
points also retain DM and the reported e_DM uncertainty, including the asymmetric
distance interval obtained from DM +/- e_DM. Missing errors and Hubble-law
errors are null, not zero. These uncertainties are metadata; the current scene
still draws a single position and does not visualize the interval.
