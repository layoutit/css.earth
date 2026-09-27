# Ganymede: Galileo brightness temperatures

Proposal 36 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

No corresponding measured PPR temperature map is selected.

A dated brightness-temperature view for the observed part of Ganymede, with the PPR footprint retained.

Content owners: [ganymede](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ganymede/README.md)

## Evidence

PIA01232 describes a 90–160 K daytime product. Its narrative contains inconsistent encounter/orbit wording, so native records must resolve the observation identity.

## Work

Recover the PPR numeric measurements and geometry, establish the epoch and radiometric interpretation, and prepare only the measured footprint.

## Limits and prior decisions

Brightness temperature is inferred from radiation and depends on assumptions; one sunlit encounter is not a global climate. No palette inversion.

## Acceptance

Resolve observation identity against native labels, independently check temperature samples and quantify footprint and uncertainty.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/temperature-map-of-ganymede/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA01232](https://science.nasa.gov/photojournal/temperature-map-of-ganymede/) | candidate | Ganymede PPR temperatures are a radiometric observation lead; native records must resolve the page's encounter wording before release. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
