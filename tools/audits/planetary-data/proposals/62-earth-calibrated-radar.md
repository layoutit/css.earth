# Earth: calibrated radar mosaics and land measurements

Proposal 62 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Earth's optical basemap does not show calibrated radar backscatter or radar-derived biomass.

Qualify a broad radar mosaic first, with land-cover or biomass products treated as separate measured or modeled quantities.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

The reviewed set includes the JERS-1 equatorial Africa mosaic, Raco land cover and biomass, Arctic RADARSAT and regional oil/lava examples.

## Work

Obtain calibrated georeferenced bands, incidence-angle information and masks. Distinguish native radar measurements from classifications and retrievals.

## Limits and prior decisions

Proposal 54 owns individual event comparisons; this proposal owns calibrated radar source handling and a representative broad mosaic. Do not publish a biomass model as raw radar reflectivity.

## Acceptance

Units, polarization, acquisition interval, incidence correction, independent numeric samples and declared footprint.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/radar-mosaic-of-africa/)
- [NASA source page](https://science.nasa.gov/photojournal/space-radar-image-of-raco-vegetation-map/)
- [NASA source page](https://science.nasa.gov/photojournal/space-radar-image-of-raco-biomass-map/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/)
- [NASA source page](https://science.nasa.gov/photojournal/uavsar-maps-the-gulf-coast-oil-spill/)
- [NASA source page](https://science.nasa.gov/photojournal/airborne-nasa-radar-maps-mauna-loa-lava-changes-in-hawaii/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA01348](https://science.nasa.gov/photojournal/radar-mosaic-of-africa/) | candidate | Nearly 4000 JERS-1 L-band images form an equatorial Africa radar mosaic; a broad new Earth wavelength lead beyond the photographic basemap. |
| [PIA01713](https://science.nasa.gov/photojournal/space-radar-image-of-raco-vegetation-map/) | candidate | Raco SIR-C/X-SAR vegetation classification is a regional categorical product, distinct from radar backscatter; recover its original class map and validation. |
| [PIA01714](https://science.nasa.gov/photojournal/space-radar-image-of-raco-biomass-map/) | candidate | Raco biomass is a radar-based inference, not the vegetation-class map itself; original model, units and uncertainties are needed. |
| [PIA02970](https://science.nasa.gov/photojournal/global-view-of-the-arctic-ocean/) | candidate | Radarsat Arctic sea-ice mosaic adds a broad radar/cryosphere lead; distinguish dated backscatter imagery from inferred motion or thickness. |
| [PIA13233](https://science.nasa.gov/photojournal/uavsar-maps-the-gulf-coast-oil-spill/) | candidate | June 2010 UAVSAR oil-spill imagery is calibrated radar-event data in principle; original backscatter and interpretation are required before mapping oil extent. |
| [PIA25526](https://science.nasa.gov/photojournal/airborne-nasa-radar-maps-mauna-loa-lava-changes-in-hawaii/) | candidate | Mauna Loa airborne radar measures eruption-related change; identify whether the selected product is height, backscatter or displacement and retain its native units. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
