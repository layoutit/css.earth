# Ceres: qualified Urvara and crater close-ups

Proposal 15 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The current Ceres imagery is global; this would be an explicitly regional close-up.

A controlled high-resolution mosaic of Urvara crater, with separate products for different source-resolution ranges.

Content owners: [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md)

## Evidence

The native label describes a 57,573 × 40,282 mosaic resampled to 5 m/pixel from 1,583 images. The method document describes source imaging at about 3.5–20 m/pixel and a mapped region from 128°W to 93°W, 59°S to 35°S.

## Work

Prepare a bounded regional raster while retaining clear coverage. Lower priority for the user's preference for broadly useful coverage.

## Limits and prior decisions

It covers one basin, not the whole body. Five-metre output sampling is not uniform five-metre resolved detail. A generic radius description in the image label is inconsistent with the photographic product; use the explicit mosaic method record.

## Acceptance

Start with the controlled Urvara product. Treat Occator, Vinalia, Dantu and Haulani images as separate leads until their native registration and incremental detail are demonstrated. Compare output against global imagery at the same camera and budget; do not label resampled 5 m pixels as uniform 5 m detail.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn-fc.urvara-mosaics/document/productdescription.txt)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn-fc.urvara-mosaics/data/)
- [PDS source record](https://sbnarchive.psi.edu/pds4/dawn/dwarf_planet-ceres.dawn-fc.urvara-mosaics/bundle_dwarf_planet-ceres.dawn-fc.urvara-mosaics.xml)
- [NASA source page](https://science.nasa.gov/photojournal/haulani-crater-topographic-map/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula-in-occator-crater/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-the-vinalia-faculae-in-occator-crater/)
- [NASA source page](https://science.nasa.gov/photojournal/color-mosaic-of-dantu-crater/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA21748](https://science.nasa.gov/photojournal/haulani-crater-topographic-map/) | candidate | Haulani regional topography may add local height detail; compare original DEM and frame with current Ceres terrain while keeping geometry fixed. |
| [PIA21924](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula-in-occator-crater/) | candidate | Cerealia extended-mission imaging from roughly 34 km altitude has gaps filled by lower-resolution context; preserve source-resolution support in a regional mosaic. |
| [PIA21925](https://science.nasa.gov/photojournal/mosaic-of-the-vinalia-faculae-in-occator-crater/) | candidate | Vinalia extended-mission mosaic is a separate regional footprint with mixed-resolution coverage; qualify originals rather than assume uniform detail. |
| [PIA22471](https://science.nasa.gov/photojournal/color-mosaic-of-dantu-crater/) | candidate | May 2018 Dantu color mosaic is a distinct regional Ceres observation; recover native bands and compare detail with current global color. |
| [PIA22480](https://science.nasa.gov/photojournal/mosaic-of-cerealia-facula/) | candidate | Cerealia mosaic is draped on an older LAMO terrain model without exaggeration; use original imagery and retain the mismatch in image/terrain resolution. |

PDS bundle IDs: `urn:nasa:pds:dwarf_planet-ceres.dawn-fc.urvara-mosaics`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
