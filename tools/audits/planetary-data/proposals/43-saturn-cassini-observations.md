# Saturn: coherent historical observing sets

Proposal 43 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Saturn already has dated OPAL, UV and methane maps. Its ledger rejects a Cassini polar cap pasted into the 2025 OPAL body.

Qualify one coherent Voyager or Cassini visible/infrared set as a separately dated dataset if coverage supports the existing map contract.

Content owners: [saturn](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/saturn/README.md)

## Evidence

The individual review includes Voyager observations, Cassini visible/infrared narrow-strip mosaics and southern-hemisphere UV imagery.

## Work

Find original map-projected products, observing intervals, ring/limb masks and longitude conventions. Measure coverage before committing to a surface view.

## Limits and prior decisions

This does not reopen cross-mission cap filling or claim the narrow-strip images are ready global maps. No cloud geometry or renderer work.

## Acceptance

Native observation identity, geometry, bandpass, measured footprint and actual improvement over the existing historical set.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/saturn-false-color-of-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/saturn-brown-ovals-in-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/saturns-northern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/photographic-mosaic-of-saturn/)
- [NASA source page](https://science.nasa.gov/photojournal/saturns-northern-hemisphere-2/)
- [NASA source page](https://science.nasa.gov/photojournal/northern-hemisphere-of-saturn/)
- [NASA source page](https://science.nasa.gov/photojournal/southern-hemisphere-in-ultraviolet/)
- [NASA source page](https://science.nasa.gov/photojournal/the-painted-globe/)
- [NASA source page](https://science.nasa.gov/photojournal/cassini-noodle-mosaic-of-saturn/)
- [NASA source page](https://science.nasa.gov/photojournal/cassini-near-infrared-noodle-mosaic-of-saturn/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00025](https://science.nasa.gov/photojournal/saturn-false-color-of-southern-hemisphere/) | candidate | Voyager's November 1980 southern false-color image adds an epoch/band lead; its red oval is not a calibrated composition map. |
| [PIA00026](https://science.nasa.gov/photojournal/saturn-brown-ovals-in-northern-hemisphere/) | candidate | November 1980 northern ovals form a separate dated Voyager observation; partial hemisphere and geometry must be preserved. |
| [PIA01365](https://science.nasa.gov/photojournal/saturns-northern-hemisphere/) | candidate | Voyager Saturn UV/violet/green hemisphere offers a coherent historical band set with partial coverage. |
| [PIA01377](https://science.nasa.gov/photojournal/photographic-mosaic-of-saturn/) | candidate | Voyager three-frame green Saturn mosaic is a distinct dated morphology observation, not a ready global map. |
| [PIA01960](https://science.nasa.gov/photojournal/saturns-northern-hemisphere-2/) | candidate | Paired Voyager violet and green Saturn images cover the same region; a useful historical two-band set with explicit footprint. |
| [PIA02230](https://science.nasa.gov/photojournal/northern-hemisphere-of-saturn/) | candidate | Voyager November 1980 Saturn northern cloud image is a separate epoch/footprint lead for the historical observing-set proposal. |
| [PIA05412](https://science.nasa.gov/photojournal/southern-hemisphere-in-ultraviolet/) | candidate | Cassini May 2004 UV Saturn image adds a dated band observation; clouds/aerosols and gas brightness need their UV interpretation retained. |
| [PIA08396](https://science.nasa.gov/photojournal/the-painted-globe/) | candidate | Saturn Cassini color observation may add a coherent historical epoch; verify actual target despite the supplied ring tag and preserve illumination. |
| [PIA21617](https://science.nasa.gov/photojournal/cassini-noodle-mosaic-of-saturn/) | candidate | Cassini April 2017 narrow-strip mosaic covers a long latitude swath rather than a full globe; original geometry and observing interval must be retained. |
| [PIA21622](https://science.nasa.gov/photojournal/cassini-near-infrared-noodle-mosaic-of-saturn/) | candidate | June 2017 thirty-frame near-IR Saturn swath is a distinct epoch/band; partial coverage and changing camera geometry are qualification requirements. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

10 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini CIRS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 22476 | qualification |
| Cassini ISS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 132010 | qualification |
| Cassini UVIS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 109715 | qualification |
| Cassini VIMS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 121046 | qualification |
| Hubble ACS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2466 | qualification |
| Hubble NICMOS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 102 | qualification |
| Hubble STIS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 175 | qualification |
| Hubble WFC3 | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 45 | qualification |
| Hubble WFPC2 | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 265 | qualification |
| Voyager ISS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 23735 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
