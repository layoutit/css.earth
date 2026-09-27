# Gaspra and Ida: resolve the existing NIMS blockers

Proposal 24 · **Blocked by existing evidence** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Gaspra and Ida NIMS are already recorded as unresolved in the body ledgers. Eros's existing seven MSI bands do not provide X-ray elemental maps.

A bounded qualification PR resolving the recorded calibration and geometry issues in the NIMS cubes; a measured regional view is conditional on that result.

Content owners: [gaspra](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/gaspra/README.md), [ida](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ida/README.md)

## Evidence

The NEAR XRS collection has calibrated observations including level-3 directories; the scan did not find a ready global element raster. Galileo NIMS bundles contain calibrated point-perspective spectral cubes.

## Work

Keep as research candidates. Reopen the specific recorded blockers only with new evidence.

## Limits and prior decisions

Registration, footprint geometry, calibration and coverage remain substantial work. Gaspra has a pre-existing calibration-source discrepancy; Ida's current false-color coverage is only 17.2% of the display mesh. These are not replacements for the broadly covered recommendations above.

## Acceptance

Compare the original label/calibration disagreement for Gaspra and the sparse source geometry for Ida. Do not treat a PDS4 migration as new calibration evidence. A negative result updates the existing ledger, not an invented map.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.nims.spectra/bundle_galileo.ast-gaspra.nims.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-gaspra.nims.spectral-cube/bundle_galileo.ast-gaspra.nims.spectral-cube.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-ida.nims.spectra/bundle_galileo.ast-ida.nims.spectra.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/derived/galileo.ast-ida.nims.spectral-cubes/bundle_galileo.ast-ida.nims.spectral-cubes.xml)

PDS bundle IDs: `urn:nasa:pds:galileo.ast-gaspra.nims.spectra`, `urn:nasa:pds:galileo.ast-gaspra.nims.spectral-cube`, `urn:nasa:pds:galileo.ast-ida.nims.spectra`, `urn:nasa:pds:galileo.ast-ida.nims.spectral-cubes`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
