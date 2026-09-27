# Saturn moons: controlled ISS regional photography

Proposal 68 · **Regional candidate** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

These moons already have global photography. Enceladus VIMS composition work belongs to the other active proposal, not this one.

Qualify useful native ISS close-ups on the existing body geometry, starting with the strongest measurable detail gain.

Content owners: [phoebe](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/phoebe/README.md), [rhea](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/rhea/README.md), [dione](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/dione/README.md), [tethys](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/tethys/README.md), [mimas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/mimas/README.md), [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md)

## Evidence

The individual entries include Phoebe, Rhea, Dione, Tethys and Mimas regions and Enceladus close-flyby mosaics, including a 12.3 m sampling example.

## Work

For each moon, deduplicate against current source images, obtain controlled poses and calibrated frames, and record an independent go/no-go result before preparing an addition.

## Limits and prior decisions

Sampling is not uniform resolved detail. Regional imagery must retain its footprint and shadows. No new surface-photo panel or replacement geometry.

## Acceptance

Per-body current-input comparison, landmark residuals, footprint, effective detail and byte budget. Implement successful bodies separately when their source work is independent.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/phoebe-hi-resolution-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/zooming-in-on-enceladus-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/rhea-polar-view/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-trailing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/dione-north-polar-view/)
- [NASA source page](https://science.nasa.gov/photojournal/leading-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/the-southern-hemisphere-of-enceladus/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-rev-91-flyby-skeet-shoot-1-4-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/trailing-hemisphere-craters/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-leading-hemisphere/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA06073](https://science.nasa.gov/photojournal/phoebe-hi-resolution-mosaic/) | candidate | Phoebe six-image close-encounter mosaic may offer regional detail beyond the selected global view; cross-match native frames and current texture support. |
| [PIA06191](https://science.nasa.gov/photojournal/enceladus-mosaic/) | candidate | Four-frame Enceladus February 2005 close-up can be checked for detail beyond the current Schenk map; no assumed improvement from the press label. |
| [PIA06254](https://science.nasa.gov/photojournal/zooming-in-on-enceladus-mosaic/) | candidate | Twenty-one-frame Enceladus July 2005 mosaic is a potential local-detail source; compare exact observations with the newer selected global release. |
| [PIA07566](https://science.nasa.gov/photojournal/rhea-polar-view/) | candidate | Rhea south-polar crater close-up may add local photographic detail; compare its original frame support with the selected 417 m global mosaic. |
| [PIA08353](https://science.nasa.gov/photojournal/enceladus-trailing-hemisphere/) | candidate | Enceladus 16-image trailing-hemisphere close-up could expose native detail beyond the delivery map; compare it against current source coverage before selecting. |
| [PIA09886](https://science.nasa.gov/photojournal/dione-north-polar-view/) | candidate | Dione north-polar frame may supply regional detail near Janiculum Dorsa; compare the native footprint with the current global mosaic. |
| [PIA10424](https://science.nasa.gov/photojournal/leading-hemisphere/) | candidate | Tethys leading-hemisphere photograph includes the dark equatorial band and Odysseus; compare calibrated regional detail with the existing global source. |
| [PIA11126](https://science.nasa.gov/photojournal/the-southern-hemisphere-of-enceladus/) | candidate | Enceladus southern high-resolution 2008 flyby mosaic is a regional-detail lead; compare its original frames with the selected Schenk input. |
| [PIA11134](https://science.nasa.gov/photojournal/enceladus-rev-91-flyby-skeet-shoot-1-4-mosaic/) | candidate | Enceladus October 2008 four-frame mosaic at 12.3 m/pixel is a concrete local-detail opportunity if camera registration and display budget support it. |
| [PIA11582](https://science.nasa.gov/photojournal/trailing-hemisphere-craters/) | candidate | Mimas northern/trailing crater view offers regional imaging at a stated orientation; compare native resolution and footprint with the selected map. |
| [PIA11684](https://science.nasa.gov/photojournal/enceladus-leading-hemisphere/) | candidate | Enceladus leading-hemisphere observing set improved previously dim/low-resolution areas; compare native support with current mapping to determine residual detail gain. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

41 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Aegaeon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Aegaeon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 633 | qualification |
| Cassini ISS | [Anthe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Anthe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 802 | qualification |
| Cassini ISS | [Calypso](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Calypso&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1024 | qualification |
| Cassini ISS | [Daphnis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Daphnis&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 735 | qualification |
| Cassini ISS | [Dione](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Dione&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 5226 | qualification |
| Cassini ISS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12382 | qualification |
| Cassini ISS | [Epimetheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Epimetheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1834 | qualification |
| Cassini ISS | [Helene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Helene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1682 | qualification |
| Cassini ISS | [Hyperion](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Hyperion&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2036 | qualification |
| Cassini ISS | [Iapetus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Iapetus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 6815 | qualification |
| Cassini ISS | [Janus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Janus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2026 | qualification |
| Cassini ISS | [Methone](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Methone&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1036 | qualification |
| Cassini ISS | [Mimas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Mimas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3565 | qualification |
| Cassini ISS | [Pallene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Pallene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 966 | qualification |
| Cassini ISS | [Pan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Pan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1376 | qualification |
| Cassini ISS | [Pandora](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Pandora&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1523 | qualification |
| Cassini ISS | [Phoebe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Phoebe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1665 | qualification |
| Cassini ISS | [Polydeuces](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Polydeuces&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 744 | qualification |
| Cassini ISS | [Prometheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Prometheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3774 | qualification |
| Cassini ISS | [Rhea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Rhea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 5914 | qualification |
| Cassini ISS | [Telesto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Telesto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1030 | qualification |
| Cassini ISS | [Tethys](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Tethys&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3796 | qualification |
| Hubble NICMOS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 26 | qualification |
| Hubble WFPC2 | [Iapetus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Iapetus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 13 | qualification |
| Hubble WFPC2 | [Pandora](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Pandora&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 30 | qualification |
| Hubble WFPC2 | [Prometheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Prometheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 200 | qualification |
| Voyager ISS | [Calypso](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Calypso&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 11 | qualification |
| Voyager ISS | [Dione](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Dione&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 138 | qualification |
| Voyager ISS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 87 | qualification |
| Voyager ISS | [Epimetheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Epimetheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 11 | qualification |
| Voyager ISS | [Helene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Helene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 45 | qualification |
| Voyager ISS | [Hyperion](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Hyperion&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 110 | qualification |
| Voyager ISS | [Iapetus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Iapetus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 151 | qualification |
| Voyager ISS | [Janus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Janus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 7 | qualification |
| Voyager ISS | [Mimas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Mimas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 78 | qualification |
| Voyager ISS | [Pandora](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Pandora&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 14 | qualification |
| Voyager ISS | [Phoebe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Phoebe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 305 | qualification |
| Voyager ISS | [Prometheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Prometheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Voyager ISS | [Rhea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Rhea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 233 | qualification |
| Voyager ISS | [Telesto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Telesto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Voyager ISS | [Tethys](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Tethys&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 106 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
