# Callisto: controlled close-up photography

Proposal 58 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Callisto already has global photography, Galileo color and infrared observations.

Qualify additional SSI coverage around Valhalla, Asgard and the southern hemisphere where it adds useful observed detail.

Content owners: [callisto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/callisto/README.md)

## Evidence

The reviewed pages distinguish fine pixel sampling from coarser resolved features; PIA00561's sampling does not mean every 46 m feature is resolved. Other products combine coarse color with finer monochrome.

## Work

Obtain the native images and observation geometry, measure overlap with selected inputs, and prepare only controlled regional footprints.

## Limits and prior decisions

No global gap filling or claim that every press crop is a separate dataset. Infrared measurements belong in proposal 12.

## Acceptance

Independent image registration, resolution comparison, illumination differences, masks and byte budget.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/callisto-crater-chain-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/callisto-scarp-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/asgard-scarp-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/large-impact-on-callistos-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/)
- [NASA source page](https://science.nasa.gov/photojournal/the-asgard-hemisphere-of-callisto/)
- [NASA source page](https://science.nasa.gov/photojournal/large-craters-in-callistos-southern-hemisphere/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00549](https://science.nasa.gov/photojournal/callisto-crater-chain-mosaic/) | candidate | Callisto Valhalla crater-chain mosaic covers about 45 km with resolvable 160 m features; original registered images may add useful local detail. |
| [PIA00561](https://science.nasa.gov/photojournal/callisto-scarp-mosaic/) | candidate | Valhalla scarp mosaic has 46 m pixels but roughly 155 m resolvable details; preserve that distinction in a regional photography comparison. |
| [PIA00562](https://science.nasa.gov/photojournal/asgard-scarp-mosaic/) | candidate | Asgard composite mixes lower-resolution color with high-resolution photography; recover channels and report color support separately from visible detail. |
| [PIA01077](https://science.nasa.gov/photojournal/large-impact-on-callistos-southern-hemisphere/) | candidate | Callisto southern impact mosaic gives regional Galileo detail around a 200 km crater; source footprints may complement current imaging. |
| [PIA01079](https://science.nasa.gov/photojournal/callistos-southern-hemisphere-as-viewed-by-nims-and-ssi/) | duplicate-family | NIMS/SSI composite combines the same spectral and photographic observations shown separately; assess each instrument at its own spatial support. |
| [PIA01100](https://science.nasa.gov/photojournal/the-asgard-hemisphere-of-callisto/) | candidate | Asgard false-color SSI hemisphere could add regional calibrated bands; compare coverage with the already selected Galileo color source. |
| [PIA01219](https://science.nasa.gov/photojournal/large-craters-in-callistos-southern-hemisphere/) | candidate | Galileo southern Callisto imaging covers terrain not seen by Voyager; compare against the present combined map to establish remaining gain. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

5 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Callisto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Callisto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 38 | qualification |
| Galileo SSI | [Callisto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Callisto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 280 | qualification |
| New Horizons LORRI | [Callisto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Callisto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9 | qualification |
| New Horizons MVIC | [Callisto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Callisto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4 | qualification |
| Voyager ISS | [Callisto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Callisto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 831 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
