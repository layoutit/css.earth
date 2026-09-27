# Bennu: gravity anomaly on the observed shape

Proposal 06 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

These gravity fields are not selected surface datasets in the three current packages.

Prepare the published Bennu Bouguer anomaly, retaining its physical units and uniform-density reference model. Keep it separate from Dawn's regular-grid importer.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md)

## Evidence

Ceres and Vesta native map labels describe 360 × 181 grids, including radial acceleration and error products. Bennu's native label specifies 196,608 facet records with normalized anomaly and mGal columns. The source overview explains comparison with a uniform-density shape.

## Work

Decode the existing numeric grids at preparation time. Use plain labels such as Gravity variation, with mission attribution and a concise explanation of the reference model.

## Limits and prior decisions

These are model-derived fields. Grid spacing does not equal resolving power; harmonic degree, reference surface, density assumption, scale/offset, longitude and uncertainty all matter. An anomaly is not a direct map of hidden caverns or mineral abundance.

## Acceptance

Check all 196,608 facet rows, missing values and the distinction between normalized anomaly and mGal. Establish source-shape registration without inventing subsurface structures.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.derived_gravity_v1.1/data/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.derived_gravity_v1.1/bundle_derived_gravity.xml)

PDS bundle IDs: `urn:nasa:pds:orex.derived_gravity`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
