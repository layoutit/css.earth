# Ceres: hydrogen and iron

Proposal 03 · **Integration candidate** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Existing Ceres composition views use VIR mineral absorptions and band centres. No GRaND map is selected.

Two chemically distinct global measurements from Dawn GRaND, with their uncertainty columns.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

## Evidence

Native labels and hydrogen table inspected. The products use 110 approximately equal-area cells. Hydrogen is water-equivalent hydrogen by mass; iron is mass fraction. Measurements were collected in the low-altitude mapping orbit in 2015–2016.

## Work

Small numeric tables fit the existing prepared surface lane. Keep the coarse footprint and uncertainty visible in the description; do not produce crater-scale detail.

## Limits and prior decisions

The effective resolution is roughly 600 km FWHM. Twenty-degree cells are sampling, not independent resolved terrain. Hydrogen does not uniquely measure surface ice, and a water-equivalent value is not an ice-fraction map.

## Acceptance

Independently check table units and uncertainty columns; compare prepared cell values and boundaries against the native table. Keep the approximately 600 km footprint explicit.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-ceres_1.0/data_derived/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-ceres_1.0/bundle_dawn-grand-ceres.xml)

PDS bundle IDs: `urn:nasa:pds:dawn-grand-ceres`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
