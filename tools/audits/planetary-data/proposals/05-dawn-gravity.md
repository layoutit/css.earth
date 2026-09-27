# Ceres and Vesta: gravity, anomalies and geoid

Proposal 05 · **Integration candidate** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

These gravity fields are not selected surface datasets in the three current packages.

Prepare Dawn's published gravity, Bouguer anomaly, geoid and associated errors for Ceres and Vesta. Give each physical quantity a clear label within one related group per body.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md), [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

## Evidence

Ceres and Vesta native map labels describe 360 × 181 grids, including radial acceleration and error products. Bennu's native label specifies 196,608 facet records with normalized anomaly and mGal columns. The source overview explains comparison with a uniform-density shape.

## Work

Decode the existing numeric grids at preparation time. Use plain labels such as Gravity variation, with mission attribution and a concise explanation of the reference model.

## Limits and prior decisions

These are model-derived fields. Grid spacing does not equal resolving power; harmonic degree, reference surface, density assumption, scale/offset, longitude and uncertainty all matter. An anomaly is not a direct map of hidden caverns or mineral abundance.

## Acceptance

Read grid scale, offset, longitude, reference radius, density assumption and harmonic degree. Verify numeric samples against a separate decoder and keep uncertainty separate from anomaly. A grid cell is not the model's effective resolution.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-ceres/maps/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-vesta/maps/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-ceres/bundle-dawn-rss-der-ceres.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/gravity/dawn-rss-der-vesta/bundle-dawn-rss-der-vesta.xml)

PDS bundle IDs: `urn:nasa:pds:dawn-rss-der-ceres`, `urn:nasa:pds:dawn-rss-der-vesta`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
