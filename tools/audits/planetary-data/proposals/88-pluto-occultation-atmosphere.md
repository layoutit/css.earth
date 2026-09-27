# Pluto: observed atmospheric occultation profiles

Proposal 88 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Pluto has surface ice and height data. A stellar occultation samples atmospheric transmission rather than surface composition.

Qualify the 2007 simultaneous visible/infrared occultation curve or published atmospheric constraints through existing charts and facts.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/pluto/README.md)

## Evidence

The PDS4 package records the March 18 grazing occultation with continuous observations and timing metadata.

## Work

Retrieve calibrated light curves, geometry, time scale and uncertainties; retain the distinction between observations and any retrieved atmospheric profile.

## Limits and prior decisions

A grazing chord is not a global pressure map. Do not change atmospheric rendering or derive an unconstrained three-dimensional structure.

## Acceptance

Time alignment between bands, normalization, station geometry, uncertainty and published-model reproduction if a profile is retained.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.pluto.benecchi-etal.occultation/bundle_gbo.pluto.benecchi-etal.occultation.xml)

PDS bundle IDs: `urn:nasa:pds:gbo.pluto.benecchi-etal.occultation`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
