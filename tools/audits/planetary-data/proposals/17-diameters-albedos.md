# Small bodies: reconcile diameters and albedos

Proposal 17 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

NEOWISE is already referenced for Amycus, Echeclus, Elatus, Okyrhoe and Thereus. Many radar target bodies already exist. A catalogue must be joined against existing object identities before counting additions.

Join NEOWISE, radiometric, occultation and radar compilations to existing object IDs; update only demonstrated gaps or better-supported measurements.

Content owners: Determine the existing content owner during source qualification.

## Evidence

Latest discovered bundle versions include NEOWISE v2, LCDB v4 and occultations v4. Their inventories were read. Several are a handful of large tables, so product counts are not body counts.

## Work

A substantial facts PR is possible, using published uncertainties and an explicit source-selection policy. It adds scientific information rather than surface textures.

## Limits and prior decisions

This audit did not compute a row-level join against every existing body fact or adjudicate conflicting measurements. There is no verified number of new bodies or corrected facts yet. Old optical, radiometric and radar estimates are not interchangeable, and migration dates do not make observations new.

## Acceptance

Produce a row-level before/after fact ledger with method, epoch, uncertainty and source. Keep radiometric diameters separate from resolved shape dimensions. Do not announce a new-body count before the join.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/iras/iras/bundle_iras.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/msx/msx.mimps/bundle.msx.mimps.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.delbo.radiometric-diameters-albedos/bundle_ast.delbo.radiometric-diameters-albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast.shevchenko-tedesco.occultation-albedos/bundle_ast.shevchenko-tedesco.occultation-albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.albedos/bundle_compil.ast.albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.radar-properties/bundle_compil.ast.radar-properties.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/compil.ast.triad.radiometry/bundle_compil.ast.triad.radiometry.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/hst.ast-ceres.images-albedo-shape_V1_0/bundle_hst.ast-ceres.images-albedo-shape.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/neowise_diameters_albedos_V2_0/bundle_neowise_diameters_albedos.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/tno-centaur_diam-albedo-density_V1_0/bundle_tno-centaur_diam-albedo-density.xml)
- [NASA source page](https://science.nasa.gov/photojournal/one-year-of-neowise-observations-mapped/)
- [NASA source page](https://science.nasa.gov/photojournal/two-years-of-neowise-observations-mapped/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA19101](https://science.nasa.gov/photojournal/one-year-of-neowise-observations-mapped/) | candidate | NEOWISE survey animation points to a catalogue, not asteroid surface maps; the native identifier/diameter/albedo join owns any actual facts addition. |
| [PIA20546](https://science.nasa.gov/photojournal/two-years-of-neowise-observations-mapped/) | candidate | Two-year NEOWISE visualization extends the survey context of PIA19101; original catalogue rows, not animation dots, own any new body facts. |

PDS bundle IDs: `urn:nasa:pds:iras`, `urn:nasa:pds:msx.mimps`, `urn:nasa:pds:ast.delbo.radiometric-diameters-albedos`, `urn:nasa:pds:ast.shevchenko-tedesco.occultation-albedos`, `urn:nasa:pds:compil.ast.albedos`, `urn:nasa:pds:compil.ast.radar-properties`, `urn:nasa:pds:compil.ast.triad.radiometry`, `urn:nasa:pds:hst.ast-ceres.images-albedo-shape`, `urn:nasa:pds:neowise_diameters_albedos`, `urn:nasa:pds:tno-centaur_diam-albedo-density`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
