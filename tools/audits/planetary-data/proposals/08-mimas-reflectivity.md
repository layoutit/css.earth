# Mimas: relative reflectivity

Proposal 08 · **Integration candidate** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The source bundle already supplies Mimas's shape and radius map, but its relative-albedo product is not selected. Dione, Rhea, Tethys and Phoebe already have similar reflectivity views.

Add the SPC relative-albedo GeoTIFF beside the existing photos and elevation.

Content owners: [mimas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mimas/README.md)

## Evidence

The native mimas_albedo_g.xml describes a 2,222 × 1,111 unitless GeoTIFF associated with the SPC topography.

## Work

A bounded texture addition using the same source family. No need to change geometry. Supporting image-count or uncertainty rasters are secondary opportunities, not new physical measurements.

## Limits and prior decisions

This is relative albedo, not absolute reflectance. Read its actual geotransform and missing-data conventions; the current radius map already has a documented narrow edge gap.

## Acceptance

Inspect native GeoTIFF extent, relative scaling, geotransform and no-data before preparation. Check the known edge gap and fixed geometry. Compare with the same source-family views on Dione, Rhea, Tethys and Phoebe.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-mimas.cassini.shape-models-maps/data/mimas_albedo_g.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/satellite-mimas.cassini.shape-models-maps/bundle_satellite-mimas.cassini.shape-models-maps.xml)

PDS bundle IDs: `urn:nasa:pds:satellite-mimas.cassini.shape-models-maps`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
