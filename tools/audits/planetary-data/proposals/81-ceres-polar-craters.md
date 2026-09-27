# Ceres: measured topography inside polar craters

Proposal 81 · **Regional candidate** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The current elevation view withholds polar caps because its source cannot separate stereo measurements from interpolation.

Assess the separate nine-crater SPC release for genuinely measured regional height/albedo support within those withheld areas.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

## Evidence

The PDS4 bundle describes secondary-illumination reconstruction inside permanently shadowed regions and a v2 correction to regional albedo orientations.

## Work

Inspect each crater's native grid, reconstruction quality, frame and validity. Transfer qualified scalar height/albedo onto the existing Ceres geometry; leave all unsupported surrounding areas missing.

## Limits and prior decisions

This is not permission to fill the entire polar caps or replace the displayed mesh. A new source must satisfy the existing measurement-versus-interpolation blocker.

## Acceptance

Per-crater native samples, corrected orientation, error/validity records, independent registration and explicit ledger reopen evidence.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn.shape-models-maps/bundle_dwarf_planet-ceres.dawn.shape-models-maps.xml)

PDS bundle IDs: `urn:nasa:pds:dwarf_planet-ceres.dawn.shape-models-maps`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
