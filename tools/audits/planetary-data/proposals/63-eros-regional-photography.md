# Eros: qualify low-altitude MSI close-ups

Proposal 63 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Seven MSI bands and global photography are already selected. The repository also has preparation evidence for registered native MSI images.

Add a bounded regional improvement from native close-flyby images if it survives a same-budget comparison.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

## Evidence

The Photojournal sequence includes low-altitude observations and mosaics of boulders, craters and smooth deposits. A rendered drape is not an original MSI frame.

## Work

Cross-match source image IDs, retrieve calibrated frames and qualified backplanes, then measure new detail and support on the existing shape.

## Limits and prior decisions

Do not re-add the seven global bands. Pond coordinates belong in proposal 07; speculative boulder-size measurements from a press image are excluded.

## Acceptance

Existing camera-oracle compatibility, independent landmarks, source sampling, valid mask and prepared byte cost.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near.msi/near.msi_bundle.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/near/nearmsi.shapebackplane/bundle_nearmsi.shapebackplane.xml)
- [NASA source page](https://science.nasa.gov/photojournal/nears-first-whole-eros-mosaic-from-orbit/)
- [NASA source page](https://science.nasa.gov/photojournal/eros-image-mosaic-looking-north/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/southwest-of-the-big-crater-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/the-southern-saddle-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/looking-along-the-southern-hemisphere-of-eros/)
- [NASA source page](https://science.nasa.gov/photojournal/eros-closest-approach-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/color-mapping-the-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/a-southern-hemisphere-overview/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02467](https://science.nasa.gov/photojournal/nears-first-whole-eros-mosaic-from-orbit/) | candidate | First orbital Eros mosaic is a dated four-frame polar observation; compare source footprints against selected global MSI maps. |
| [PIA02472](https://science.nasa.gov/photojournal/eros-image-mosaic-looking-north/) | candidate | Eros crescent mosaic has roughly 35 m resolvable features and partial illumination; native frames may add a useful regional view after overlap checks. |
| [PIA02923](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere/) | candidate | Eros polar display drapes imagery on a computer shape; original source frames or registered mosaic are required, not reverse projection of the press render. |
| [PIA02924](https://science.nasa.gov/photojournal/mosaic-of-eros-northern-hemisphere-2/) | candidate | June 2000 low-sun Eros view emphasizes small relief; useful regional imaging candidate with illumination retained, not albedo inferred from shadows. |
| [PIA02933](https://science.nasa.gov/photojournal/southwest-of-the-big-crater-mosaic/) | candidate | Eight-image Eros crater-area mosaic from 50 km altitude may add regional detail; compare exact source pixels with the selected MSI base. |
| [PIA02934](https://science.nasa.gov/photojournal/the-southern-saddle-mosaic/) | candidate | Seven-image southern-saddle mosaic targets a specific regional structure; qualify footprint and registration without creating a separate photo panel. |
| [PIA03105](https://science.nasa.gov/photojournal/looking-along-the-southern-hemisphere-of-eros/) | candidate | September 2000 Eros stereo sequence gives southern context; potential regional registration evidence, not a standalone new global texture. |
| [PIA03119](https://science.nasa.gov/photojournal/eros-closest-approach-mosaic/) | candidate | Low-altitude Eros closest-approach mosaic has potentially useful boulder/regolith detail; native camera/shape geometry and tiny footprint must be qualified. |
| [PIA03120](https://science.nasa.gov/photojournal/color-mapping-the-southern-hemisphere/) | candidate | Southern crater observation is part of a color sequence; compare original channels and common coverage with the shipped seven-band MSI maps. |
| [PIA03137](https://science.nasa.gov/photojournal/a-southern-hemisphere-overview/) | candidate | December 2000 southern Eros mosaic is south-up with terminator near the equator; preserve orientation and illuminated footprint in any regional addition. |

PDS bundle IDs: `urn:nasa:pds:near.msi`, `urn:nasa:pds:nearmsi.shapebackplane`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
