# Ryugu: thermal-corrected infrared spectra

Proposal 13 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Ryugu already has thermal inertia, visible spectral slope, monochrome, enhanced color, elevation and a close-up. Those are not new opportunities.

Investigate an infrared absorption map using the 2026 NIRS3 thermal-excess-removed release, distinct from the existing visible spectral slope.

Content owners: [ryugu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ryugu/README.md)

## Evidence

The collection inventories contain 107 spectrum products and 109 geometry products. A native LBLX sample describes 128 channels × 2,695 spectra, a corresponding standard-deviation array, and an estimated-temperature array. This is an actual calibrated numeric release with geometry, not a gallery of pictures.

## Work

A source-reduction PR after a bounded coverage pilot. Reuse the existing surface renderer, but budget substantial preparation and qualification work.

## Limits and prior decisions

There is no ready global hydration raster in this bundle. Quality filtering, geometry association, thermal correction limits and footprint coverage must be established. A source release date is not the observation date.

## Acceptance

Join the 107 spectrum products and 109 geometry products by identifiers, not row order. Independently check channel wavelengths, thermal correction, standard deviations and valid footprint coverage. Release a map only if the inferred signature survives these checks.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_nirs3_sp_v1.0/readme_v001.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_nirs3_sp_v1.0/)

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
