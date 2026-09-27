# Bennu: heat storage, roughness and predicted temperatures

Proposal 01 · **Integration candidate** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Bennu has albedo, monochrome, four reflected-light bands, spectral color and elevation. No thermal view is present at the pinned revision.

Eight global maps: OTES and OVIRS thermal inertia, OTES and OVIRS thermal roughness, and four OTES-based temperature extremes at the nearest and farthest points from the Sun. Group related maps with the existing arrow selector.

Content owners: [bennu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/bennu/README.md)

## Evidence

The collection inventory lists 16 products: eight global maps, four site-specific thermal-inertia maps and four site meshes. Full scans of both global inertia FITS tables found 48,958/49,152 finite values for OTES (99.61%) and 48,273/49,152 for OVIRS (98.21%). These are facet counts, not area-weighted coverage. Each file is 1,189,440 bytes.

## Work

Prepare facet values and uncertainty on the current surface; preserve missing values; retain the source instrument and model identity. No renderer change is expected.

## Limits and prior decisions

Thermal inertia is a fitted measure of resistance to heating and cooling. Temperature extremes are predictions, not simultaneous observations. The FITS names a v034 SPO source shape; the displayed Bennu uses OLA v20. Verify transfer without replacing the display mesh. The OVIRS file incorrectly says OTES in INSTRUME; its product name and companion record identify OVIRS. Roughness and temperature payloads still need their own numeric checks.

## Acceptance

Compare decoded samples against the source FITS; measure area-weighted coverage after mesh transfer; check seams, poles, picking and the instrument selector. Resolve the OVIRS header conflict in the source record.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/data_thermal_maps/collection_inventory_data_thermal_maps.csv)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/document/thermal_sis.pdf)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/data_thermal_maps/global_thermal_inertia_maps/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/orex/orex.thermal/bundle_thermal.xml)

PDS bundle IDs: `urn:nasa:pds:orex.thermal`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
