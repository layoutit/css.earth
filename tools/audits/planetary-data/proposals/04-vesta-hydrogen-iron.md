# Vesta: hydrogen and iron signal

Proposal 04 · **Integration candidate** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The current Vesta package has imagery, spectral ratios and elevation. No GRaND measurement is selected.

Hydrogen and corrected iron gamma-ray signal; neutron absorption is a possible later addition.

Content owners: [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

## Evidence

Hydrogen has 16,200 two-degree cells, µg/g values and uncertainty. Effective spatial resolution is about 300 km FWHM. The corrected iron table is a count-rate product, not a directly measured iron mass fraction.

## Work

Reuse the Ceres GRaND reader while preserving different units and frame conventions. The renderer can remain unchanged.

## Limits and prior decisions

The release uses Claudia Double Prime; the current body uses Claudia. A documented offline coordinate conversion is required. Do not adopt the archive's preliminary iron conversion without its stated limitations. Two-degree sampling does not mean two-degree resolution.

## Acceptance

Verify Claudia Double Prime to Claudia coordinates against independent landmarks. Check hydrogen values and uncertainty, iron count-rate units, missing cells and the approximately 300 km effective resolution.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/data_derived/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/grand/dawn-grand-vesta_1.0/bundle_dawn-grand-vesta.xml)
- [NASA source page](https://science.nasa.gov/photojournal/hydrogen-map-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/contour-map-of-hydrogen-on-vesta/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA16180](https://science.nasa.gov/photojournal/hydrogen-map-of-vesta/) | candidate | Vesta GRaND hydrogen is measured elemental information, likely mineral-bound rather than ice; integrate the verified PDS4 numeric release instead of the press image. |
| [PIA16181](https://science.nasa.gov/photojournal/contour-map-of-hydrogen-on-vesta/) | duplicate-family | Hydrogen/albedo contour comparison illustrates the same GRaND measurement family and a correlation; not an independent abundance dataset. |

PDS bundle IDs: `urn:nasa:pds:dawn-grand-vesta`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
