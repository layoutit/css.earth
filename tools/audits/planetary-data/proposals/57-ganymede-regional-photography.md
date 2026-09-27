# Ganymede: controlled close-up photography

Proposal 57 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Global monochrome, enhanced color, geology and oxygen data already exist. New photographs must improve measured coverage, registration or useful detail.

Qualify a small set of native Galileo SSI regional mosaics, starting with Uruk Sulcus and Galileo Regio.

Content owners: [ganymede](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ganymede/README.md)

## Evidence

The individual review found roughly 74 m and 80 m sampling in close-up products, plus mixed-resolution color composites. These are regional observations.

## Work

Recover original calibrated frames and control geometry; cross-match frame IDs against the current photography; compare native and prepared detail at identical viewing conditions.

## Limits and prior decisions

The press insets and color composites are not georeferenced scalar products. Do not manufacture high-resolution color by treating a coarse color overlay as fine measured detail.

## Acceptance

Landmark residuals, source frame identities, valid footprint, actual resolution and delivered bytes. Add only a demonstrated improvement on the fixed body.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/ganymede-galileo-mosaic-overlayed-on-voyager-data-in-uruk-sulcus-region/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymedes-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/galileo-regio-mosaic-galileo-over-voyager-data/)
- [NASA source page](https://science.nasa.gov/photojournal/uruk-sulcus-mosaic-galileo-over-voyager-data/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymede-uruk-sulcus-high-resolution-mosaic-shown-in-context/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymede-galileo-regio-high-resolution-mosaic-shown-in-context/)
- [NASA source page](https://science.nasa.gov/photojournal/completing-a-global-map-of-ganymede/)
- [NASA source page](https://science.nasa.gov/photojournal/ganymedes-trailing-hemisphere/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00281](https://science.nasa.gov/photojournal/ganymede-galileo-mosaic-overlayed-on-voyager-data-in-uruk-sulcus-region/) | candidate | Ganymede Uruk Sulcus offers approximately 74 m local Galileo detail over a 1.3 km Voyager context; isolate original registered observations before integration. |
| [PIA00356](https://science.nasa.gov/photojournal/ganymedes-northern-hemisphere/) | candidate | Voyager northern Ganymede color is a potential regional band comparison, but original frames must improve coverage or color evidence over the current global map. |
| [PIA00492](https://science.nasa.gov/photojournal/galileo-regio-mosaic-galileo-over-voyager-data/) | candidate | Galileo Regio local mosaic resolves roughly 80 m features against a Voyager context; qualify its own footprint and separate the background image. |
| [PIA00493](https://science.nasa.gov/photojournal/uruk-sulcus-mosaic-galileo-over-voyager-data/) | candidate | Uruk Sulcus 120 by 110 km mosaic overlaps PIA00281's source family; check observation IDs to avoid duplicate regional datasets. |
| [PIA00579](https://science.nasa.gov/photojournal/ganymede-uruk-sulcus-high-resolution-mosaic-shown-in-context/) | duplicate-family | Uruk Sulcus context plate reuses the high-resolution Galileo mosaic with Voyager/full-disc insets; keep one original observation set. |
| [PIA00580](https://science.nasa.gov/photojournal/ganymede-galileo-regio-high-resolution-mosaic-shown-in-context/) | duplicate-family | Galileo Regio context image belongs with PIA00492's source mosaic; contextual packaging must not inflate regional coverage. |
| [PIA01606](https://science.nasa.gov/photojournal/completing-a-global-map-of-ganymede/) | candidate | Galileo image deliberately fills a Voyager imaging gap; compare that footprint against the current combined Ganymede source before deciding it remains new. |
| [PIA01666](https://science.nasa.gov/photojournal/ganymedes-trailing-hemisphere/) | candidate | Enhanced trailing-hemisphere Ganymede color may support a regional band comparison; original calibration must distinguish polar frost signatures from cosmetic color. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

5 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 343 | qualification |
| Galileo SSI | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 314 | qualification |
| New Horizons LORRI | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 97 | qualification |
| New Horizons MVIC | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4 | qualification |
| Voyager ISS | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 835 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
