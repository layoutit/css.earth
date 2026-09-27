# Mercury: historical and additional spectral observations

Proposal 65 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Native global BDR, LOI, enhanced color, elevation and a MASCS spectrum are already selected.

Qualify a distinct Mariner 10 epoch or measured MDIS filter set beyond the existing enhanced-color view.

Content owners: [mercury](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mercury/README.md)

## Evidence

The reviewed entries include Mariner 10 maps and a MESSENGER sequence of five scenes in eleven filters. Press RGB maps do not retain all those measurements.

## Work

Identify original filters, calibration, epochs and registered footprints; compare their actual values and coverage with current inputs.

## Limits and prior decisions

No duplicate row for a press rendering of the shipped global map. Keep measured bands distinct from an enhanced-color composite and from elemental products in proposal 30.

## Acceptance

Band centers, scale, geometry, common footprint and an explicit statement of what the addition teaches.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/outgoing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/incoming-hemisphere-enhanced-color/)
- [NASA source page](https://science.nasa.gov/photojournal/mercurys-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/five-of-five-the-last-scene-in-a-high-resolution-color-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/the-new-three-color-mosaic/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02418](https://science.nasa.gov/photojournal/outgoing-hemisphere/) | candidate | Mariner 10 outgoing Mercury hemisphere provides a 1974 historical observation, though current MESSENGER maps are the spatial baseline. |
| [PIA02440](https://science.nasa.gov/photojournal/incoming-hemisphere-enhanced-color/) | candidate | Recalibrated Mariner 10 enhanced color could add a distinct spectral comparison; native channels and processing must replace mineral claims inferred from RGB. |
| [PIA03101](https://science.nasa.gov/photojournal/mercurys-southern-hemisphere/) | candidate | Mariner southern Mercury photomosaic is a historical imaging variant; compare native inputs with other Mariner mosaics and current MESSENGER coverage. |
| [PIA11765](https://science.nasa.gov/photojournal/five-of-five-the-last-scene-in-a-high-resolution-color-mosaic/) | candidate | MESSENGER five-scene eleven-filter flyby sequence supplies a specific spectral lead beyond a press RGB map; qualify native channels and common footprint. |
| [PIA18108](https://science.nasa.gov/photojournal/the-new-three-color-mosaic/) | candidate | MESSENGER three-color release may provide native measured channels beyond enhanced-color presentation; compare with current inputs before deciding on additional band choices. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
