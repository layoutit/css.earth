# Europa: measure the value of controlled regional mosaics

Proposal 55 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Europa already uses a broad set of individual CLEAR images, plus global and other mission imagery.

Replace or extend existing photography only where the controlled mosaic release improves registration, measured coverage or useful close-up detail.

Content owners: [europa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/europa/README.md)

## Evidence

The USGS audit identifies a 92-mosaic archive overlapping the current 332 individual CLEAR images. The press close-ups are supporting observation leads, not 92 new datasets.

## Work

Cross-match observation IDs and map versions, measure geometric and coverage differences, and select replacements only after a matched preparation comparison.

## Limits and prior decisions

Keep geometry and current photographic controls. No separate photo gallery, global gap filling or claim that a newer wrapper improves resolution.

## Acceptance

Image-source deduplication, common-landmark residuals, measured area and delivered bytes at the same camera and texture budget.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/photogrammetrically_controlled_galileo_image_mosaics_of_europa)
- [NASA source page](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-europas-ridges-craters-2/)
- [NASA source page](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-and-similar-scales-on-earth/)
- [NASA source page](https://science.nasa.gov/photojournal/europas-leading-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/regional-mosaic-of-chaos-and-gray-band-on-europa/)
- [NASA source page](https://science.nasa.gov/photojournal/high-resolution-mosaic-of-ridges-plains-and-mountains-on-europa/)
- [NASA source page](https://science.nasa.gov/photojournal/europas-jupiter-facing-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/highest-resolution-europa-image-and-mosaic-from-galileo/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00587](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-2/) | candidate | Europa trailing-hemisphere close-up has a defined 100 by 140 km footprint; cross-match source IDs with the existing CLEAR-image preparation. |
| [PIA00589](https://science.nasa.gov/photojournal/mosaic-of-europas-ridges-craters-2/) | candidate | February 1997 Europa mosaic offers 20 m pixels over a small ridge region; qualify registration and incremental detail without claiming global resolution. |
| [PIA00596](https://science.nasa.gov/photojournal/close-up-of-europas-trailing-hemisphere-and-similar-scales-on-earth/) | duplicate-family | Europa/Earth comparison plate reuses the PIA00587 regional observation; the San Francisco panel is an educational comparison, not added Europa data. |
| [PIA00874](https://science.nasa.gov/photojournal/europas-leading-hemisphere/) | candidate | Galileo Europa leading hemisphere includes Tyre and long lineaments; compare original image IDs against existing coverage before selecting another mosaic. |
| [PIA01125](https://science.nasa.gov/photojournal/regional-mosaic-of-chaos-and-gray-band-on-europa/) | candidate | Europa E11 chaos/gray-band regional mosaic may improve local photography; compare registered originals with current CLEAR images. |
| [PIA01126](https://science.nasa.gov/photojournal/high-resolution-mosaic-of-ridges-plains-and-mountains-on-europa/) | candidate | Europa E11 high-resolution ridges mosaic has useful local structural detail; qualification needs exact original extent and image overlap. |
| [PIA02528](https://science.nasa.gov/photojournal/europas-jupiter-facing-hemisphere-2/) | candidate | Europa twelve-frame November 1999 mosaic has approximately 1 km pixels plus lower-resolution context; establish improvement over current CLEAR coverage. |
| [PIA21431](https://science.nasa.gov/photojournal/highest-resolution-europa-image-and-mosaic-from-galileo/) | candidate | Europa mosaic includes a 6 m/pixel footprint and seven coarser frames; regional detail is a concrete candidate with explicit source support and registration. |

USGS catalogue IDs: `photogrammetrically_controlled_galileo_image_mosaics_of_europa`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

5 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 302 | qualification |
| Galileo SSI | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 706 | qualification |
| New Horizons LORRI | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 53 | qualification |
| New Horizons MVIC | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4 | qualification |
| Voyager ISS | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 459 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
