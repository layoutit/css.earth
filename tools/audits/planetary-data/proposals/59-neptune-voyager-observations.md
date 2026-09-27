# Neptune: a dated Voyager cloud observation

Proposal 59 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Neptune uses OPAL maps and a qualified color reference. Its ledger already defers older OPAL maps with a different photometric coefficient.

Determine whether a separate Voyager epoch adds a faithful historical cloud observation through the current dataset controls.

Content owners: [neptune](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/neptune/README.md)

## Evidence

PIA00050 shows a partial southern-hemisphere observation, not a complete timeless surface map.

## Work

Recover original Voyager filters, timing and camera geometry; determine the required prepared photometric treatment and measured coverage.

## Limits and prior decisions

No renderer change, no insertion into modern OPAL gaps and no inference of cloud evolution from unmatched processing. A dated dataset is conditional on current-contract compatibility.

## Acceptance

Source identity, longitude convention, calibrated band combination, footprint and the existing photometry ledger's constraints.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/neptunes-southern-hemisphere/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00050](https://science.nasa.gov/photojournal/neptunes-southern-hemisphere/) | candidate | Voyager Neptune southern cloud image offers a dated atmospheric observation, not a global replacement; original pointing and a coherent observing set are required. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

8 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Hubble ACS | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 110 | qualification |
| Hubble NICMOS | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 141 | qualification |
| Hubble STIS | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 79 | qualification |
| Hubble WFC3 | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 632 | qualification |
| Hubble WFPC2 | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 480 | qualification |
| New Horizons LORRI | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 31 | qualification |
| New Horizons MVIC | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 10 | qualification |
| Voyager ISS | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 6869 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
