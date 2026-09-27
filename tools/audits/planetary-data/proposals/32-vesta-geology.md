# Vesta: mapped geological units

Proposal 32 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The selected Vesta views include photographs, spectral ratios and elevation, without this geological-unit map.

Qualify published geological units and original bright/dark deposit catalogues for Vesta through existing categorical and feature content.

Content owners: [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

## Evidence

PIA18788 combines 15 quadrangle maps in a Mollweide map using Dawn Claudia coordinates.

## Work

Locate original unit boundaries, deposit tables and legends. Keep mapped geological interpretation distinct from reflectance and the VIR mineral measurements in proposal 31.

## Limits and prior decisions

The press sheet includes labels and a legend; it is not a clean numeric input. Map units are interpreted terrain categories, not exact ages or measured mineral fractions.

## Acceptance

Verify unit boundaries, categorical resampling, landmark orientation, legend completeness and source reuse terms.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/map-of-bright-areas-on-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-dark-materials-on-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/geological-map-of-vesta/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA15233](https://science.nasa.gov/photojournal/map-of-bright-areas-on-vesta/) | candidate | Vesta bright-material locations may support a geological/deposit catalogue if original coordinates and definitions are available; brightness alone is not composition. |
| [PIA15238](https://science.nasa.gov/photojournal/map-of-dark-materials-on-vesta/) | candidate | Vesta dark-material map distinguishes deposit settings with symbols; recover the research catalogue/units rather than digitize press marks as exact coordinates. |
| [PIA18788](https://science.nasa.gov/photojournal/geological-map-of-vesta/) | candidate | Vesta fifteen-quadrangle geology combines mapped units in Claudia coordinates; native categorical/vector data could add a distinct geology view. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
