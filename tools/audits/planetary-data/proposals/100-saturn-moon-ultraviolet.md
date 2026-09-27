# Saturn moons: measured ultraviolet spectra

Proposal 100 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Visible/infrared composites do not expose the archived ultraviolet measurements as spectra with their original calibration and observing conditions.

Qualify selected UVIS and Hubble STIS spectra as existing prepared charts; a surface band is optional only where resolved footprints and registration support it.

Content owners: [mimas](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/mimas/README.md), [enceladus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/enceladus/README.md), [tethys](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/tethys/README.md), [dione](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/dione/README.md), [rhea](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/rhea/README.md), [iapetus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/iapetus/README.md), [phoebe](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/phoebe/README.md), [hyperion](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/hyperion/README.md).

## Evidence

The Dione UVIS example has a native FUV cube plus a versioned calibration-correction product. Catalogue records also mix HDAC time series, EUV/FUV scans and different observing purposes.

## Work

Separate sunlight reflected by ice from atmospheric emission, background and detector calibration. Apply the documented correction for the selected release, inspect slit footprints, and compare with existing VIMS/visible source coverage.

## Limits and prior decisions

A target name or generic Emission field does not establish a surface reflectance measurement. Raw counts and correction factors are not final radiance or I/F. Unresolved spectra must stay charts, not painted surface patches.

## Acceptance

Validate units and correction direction against native documentation; retain spectral errors and resolution, event time and pointing. Demonstrate that existing chart or surface preparation supports the chosen result.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [co-uvis-fuv2004_171_23_11](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Dione&COUVISchannel=FUV&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Emission, 2004-06-19T23:11:30.616. [Read native label](../evidence/labels/dione-ultraviolet.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COUVIS_0xxx/COUVIS_0007/CALIB/VERSION_3/D2004_171/FUV2004_171_23_11_CAL_3.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

28 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini UVIS | [Aegaeon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Aegaeon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 24 | qualification |
| Cassini UVIS | [Atlas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Atlas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 42 | qualification |
| Cassini UVIS | [Calypso](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Calypso&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12 | qualification |
| Cassini UVIS | [Daphnis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Daphnis&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 57 | qualification |
| Cassini UVIS | [Dione](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Dione&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2133 | qualification |
| Cassini UVIS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4965 | qualification |
| Cassini UVIS | [Epimetheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Epimetheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 72 | qualification |
| Cassini UVIS | [Helene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Helene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 54 | qualification |
| Cassini UVIS | [Hyperion](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Hyperion&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 554 | qualification |
| Cassini UVIS | [Iapetus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Iapetus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2303 | qualification |
| Cassini UVIS | [Janus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Janus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 90 | qualification |
| Cassini UVIS | [Methone](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Methone&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9 | qualification |
| Cassini UVIS | [Mimas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Mimas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1053 | qualification |
| Cassini UVIS | [Pallene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Pallene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9 | qualification |
| Cassini UVIS | [Pan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Pan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12 | qualification |
| Cassini UVIS | [Pandora](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Pandora&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 33 | qualification |
| Cassini UVIS | [Phoebe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Phoebe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 87 | qualification |
| Cassini UVIS | [Polydeuces](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Polydeuces&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 54 | qualification |
| Cassini UVIS | [Prometheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Prometheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | qualification |
| Cassini UVIS | [Rhea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Rhea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2291 | qualification |
| Cassini UVIS | [Telesto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Telesto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 30 | qualification |
| Cassini UVIS | [Tethys](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Tethys&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1481 | qualification |
| Hubble STIS | [Dione](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Dione&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9 | qualification |
| Hubble STIS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 22 | qualification |
| Hubble STIS | [Mimas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Mimas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 8 | qualification |
| Hubble STIS | [Prometheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Prometheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 16 | qualification |
| Hubble STIS | [Rhea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Rhea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 8 | qualification |
| Hubble STIS | [Tethys](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Tethys&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 16 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
