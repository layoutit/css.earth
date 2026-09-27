# Eros: 334 mapped pond locations

Proposal 07 · **Integration candidate** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Eros currently has IAU named features and seven reflected-light maps. The pond catalogue is not included.

A scientific feature catalogue of smooth deposits, placed through the existing surface-feature contract.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

## Evidence

The native label declares 334 records with pond number, IAU_EROS Cartesian coordinates, north latitude, east longitude and diameter in kilometres. The bundle description says the locations were transferred from MSI pixels to the Gaskell SPC shape with SBMT; frame constants are identified in eros_alex.tpc.

## Work

Import the feature table into the existing prepared feature system. Useful and understandable, but smaller than the multi-map proposals above.

## Limits and prior decisions

Ponds are smooth deposits of fine material, not liquid water. The source warns that several catalogue circles can belong to one continuous deposit, and detection is biased by image resolution, especially below 30 m. Diameters are characteristic sizes of generally noncircular features. Catalogue IDs must not be presented as IAU names.

## Acceptance

Import all 334 catalogue records with stable research IDs, coordinates and characteristic diameter. Validate the IAU_EROS frame and size units. Keep multiple circles belonging to one deposit distinguishable; never call them 334 separate ponds or IAU names.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/data/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/document/bundle_description.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-eros.roberts.ponds-catalog_V1_1/bundle_ast-eros.roberts.ponds-catalog.xml)

PDS bundle IDs: `urn:nasa:pds:ast-eros.roberts.ponds-catalog`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
