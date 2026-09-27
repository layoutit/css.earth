# Itokawa: more AMICA wavelengths

Proposal 14 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The current ten-frame v-band mosaic already uses this source family and has 84.26% sampled display-mesh coverage. It is not a new backplane discovery.

Investigate additional AMICA filters using the archived geometry backplanes.

Content owners: [itokawa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/itokawa/README.md)

## Evidence

The archive contains the AMICA observation and backplane bundles. The body ledger records successful selected paired exposures and other exposures rejected by the existing brightness or registration limits.

## Work

Survey same-pointing filter sets and demonstrate worthwhile registered coverage before committing to a large PR.

## Limits and prior decisions

Do not imply matching coverage in every band, reuse rejected exposures without new evidence, or relax registration tolerances to fill gaps. The separate native SBMT comparison has a documented unresolved one-pixel issue; the controlled-DDR production route is separate.

## Acceptance

Compare co-pointed filters and exposure/registration residuals against the current ten v-band frames. Report coverage per filter and common coverage before selecting a band set. Backplane availability alone does not repair the existing rejected exposures.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.amica/bundle_hay.amica.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.amica.itokawa.backplanes_v1.0/bundle_hay.amica.itokawa.backplanes.xml)

PDS bundle IDs: `urn:nasa:pds:hay.amica`, `urn:nasa:pds:hay.amica.itokawa.backplanes`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
