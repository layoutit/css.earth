# Eros: qualify X-ray, gamma-ray and infrared composition data

Proposal 23 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Gaspra and Ida NIMS are already recorded as unresolved in the body ledgers. Eros's existing seven MSI bands do not provide X-ray elemental maps.

Establish whether NEAR XRS, GRS or NIS can support a distinct elemental or spectral map with useful measured coverage.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

## Evidence

The NEAR XRS collection has calibrated observations including level-3 directories; the scan did not find a ready global element raster. Galileo NIMS bundles contain calibrated point-perspective spectral cubes.

## Work

Keep as research candidates. Reopen the specific recorded blockers only with new evidence.

## Limits and prior decisions

Registration, footprint geometry, calibration and coverage remain substantial work. Gaspra has a pre-existing calibration-source discrepancy; Ida's current false-color coverage is only 17.2% of the display mesh. These are not replacements for the broadly covered recommendations above.

## Acceptance

Keep instrument footprints, solar excitation/calibration, units and uncertainty. Inventory level-3 products before raw reduction. Do not count the already shipped seven MSI bands as this addition.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_grs/bundle_near.grs.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near.nis/bundle_near.nis.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_xrs/bundle_near.xrs.xml)

PDS bundle IDs: `urn:nasa:pds:near.grs`, `urn:nasa:pds:near.nis`, `urn:nasa:pds:near.xrs`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
