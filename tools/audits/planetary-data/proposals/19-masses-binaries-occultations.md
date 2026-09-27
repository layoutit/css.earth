# Small bodies: masses, densities and binary properties

Proposal 19 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

NEOWISE is already referenced for Amycus, Echeclus, Elatus, Okyrhoe and Thereus. Many radar target bodies already exist. A catalogue must be joined against existing object identities before counting additions.

Improve existing physical facts with published masses, densities, binary parameters and occultation size constraints, including their uncertainties.

Content owners: Determine the existing content owner during source qualification.

## Evidence

Latest discovered bundle versions include NEOWISE v2, LCDB v4 and occultations v4. Their inventories were read. Several are a handful of large tables, so product counts are not body counts.

## Work

A substantial facts PR is possible, using published uncertainties and an explicit source-selection policy. It adds scientific information rather than surface textures.

## Limits and prior decisions

This audit did not compute a row-level join against every existing body fact or adjudicate conflicting measurements. There is no verified number of new bodies or corrected facts yet. Old optical, radiometric and radar estimates are not interchangeable, and migration dates do not make observations new.

## Acceptance

Resolve object/component IDs and correlated quantities. A binary-system mass is not an individual component mass. Do not derive precise density from incompatible size and mass estimates or turn an occultation chord into a surface map.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast_binary_parameters_compilation_V3_0/bundle_ast_binary_parameters_compilation.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.shevchenko-tedesco.occultation-albedos/bundle_ast.shevchenko-tedesco.occultation-albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.masses/bundle_compil.ast.masses.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.pluto-charon.mutual-events/bundle_gbo.pluto-charon.mutual-events.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.pluto.benecchi-etal.occultation/bundle_gbo.pluto.benecchi-etal.occultation.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/smallbodiesoccultations_V4_0/bundle_smallbodiesoccultations.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/tno-centaur_diam-albedo-density_V1_0/bundle_tno-centaur_diam-albedo-density.xml)

PDS bundle IDs: `urn:nasa:pds:ast_binary_parameters_compilation`, `urn:nasa:pds:ast.shevchenko-tedesco.occultation-albedos`, `urn:nasa:pds:compil.ast.masses`, `urn:nasa:pds:gbo.pluto-charon.mutual-events`, `urn:nasa:pds:gbo.pluto.benecchi-etal.occultation`, `urn:nasa:pds:smallbodiesoccultations`, `urn:nasa:pds:tno-centaur_diam-albedo-density`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
