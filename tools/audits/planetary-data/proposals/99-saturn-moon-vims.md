# Saturn moons: qualify additional infrared bands and coverage

Proposal 99 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Dione, Rhea, Tethys, Iapetus and Phoebe already have infrared/ice views. Mimas and Hyperion are the clearest missing VIMS cases in this set. Enceladus now has the merged infrared mosaic and is not another new infrared addition.

Start with measured VIMS bands for Mimas and Hyperion; extend another moon only when a native-source comparison establishes new coverage or a distinct useful spectral measurement.

Content owners: [mimas](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/mimas/README.md), [hyperion](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/hyperion/README.md), [dione](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/dione/README.md), [rhea](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/rhea/README.md), [tethys](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/tethys/README.md), [iapetus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/iapetus/README.md), [phoebe](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/phoebe/README.md).

## Evidence

Read labels identify 48×352×12 and 36×352×24 QUBEs for the inspected Mimas and Hyperion products. OPUS also finds a sharp Dione observation, but its label is only 64×352×1: one spatial line, not a high-resolution global map. OPUS exposes raw QUBEs and geometry summaries, not a ready calibrated global mosaic.

## Work

Recover the documented radiometric calibration and wavelength tables, separate VIS/IR channels sharing a QUBE, validate per-pixel geometry and compare against the selected corrected mosaics. Prefer independent registration and measured area gain over more catalogue rows.

## Limits and prior decisions

A band-depth indicator is not mineral abundance. Resolution sorting does not rank total useful coverage. Preserve scan gaps, saturation and fixed moon geometry; do not reopen rejected registrations without new evidence.

## Acceptance

Independent calibrated samples, wavelength selection, held-out registration, area-weighted support and overlap checks. Report each moon separately, including any case that produces no useful addition.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [co-vims-v1818531048_040_ir](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Dione&surfacegeometrytargetname=Dione&SURFACEGEOdione_centerresolution1=0.000001&order=SURFACEGEOdione_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Reflectivity, 2015-08-17T18:33:16.480. [Read native label](../evidence/labels/dione-infrared.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0076/data/2015229T143120_2015229T225720/v1818531048_4_040.lbl).
- [co-vims-v1644777564_ir](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Mimas&surfacegeometrytargetname=Mimas&SURFACEGEOmimas_centerresolution1=0.000001&order=SURFACEGEOmimas_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Reflectivity, 2010-02-13T17:55:21.837. [Read native label](../evidence/labels/mimas-infrared.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0041/data/2010044T055716_2010044T203312/v1644777564_1.lbl).
- [co-vims-v1506393701_vis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Hyperion&surfacegeometrytargetname=Hyperion&SURFACEGEOhyperion_centerresolution1=0.000001&order=SURFACEGEOhyperion_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectral Cube, Reflectivity, 2005-09-26T02:13:14.560. [Read native label](../evidence/labels/hyperion-infrared.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COVIMS_0xxx/COVIMS_0008/data/2005269T015111_2005269T030239/v1506393701_1.lbl).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

22 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini VIMS | [Aegaeon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Aegaeon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 732 | qualification |
| Cassini VIMS | [Anthe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Anthe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 882 | qualification |
| Cassini VIMS | [Atlas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Atlas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 134 | qualification |
| Cassini VIMS | [Calypso](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Calypso&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 126 | qualification |
| Cassini VIMS | [Daphnis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Daphnis&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 166 | qualification |
| Cassini VIMS | [Dione](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Dione&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9817 | qualification |
| Cassini VIMS | [Epimetheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Epimetheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 322 | qualification |
| Cassini VIMS | [Helene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Helene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 470 | qualification |
| Cassini VIMS | [Hyperion](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Hyperion&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3658 | qualification |
| Cassini VIMS | [Iapetus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Iapetus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 7237 | qualification |
| Cassini VIMS | [Janus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Janus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 830 | qualification |
| Cassini VIMS | [Methone](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Methone&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 454 | qualification |
| Cassini VIMS | [Mimas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Mimas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4442 | qualification |
| Cassini VIMS | [Pallene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Pallene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 318 | qualification |
| Cassini VIMS | [Pan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Pan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 248 | qualification |
| Cassini VIMS | [Pandora](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Pandora&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 224 | qualification |
| Cassini VIMS | [Phoebe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Phoebe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1010 | qualification |
| Cassini VIMS | [Polydeuces](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Polydeuces&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 168 | qualification |
| Cassini VIMS | [Prometheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Prometheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 190 | qualification |
| Cassini VIMS | [Rhea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Rhea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12656 | qualification |
| Cassini VIMS | [Telesto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Telesto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 162 | qualification |
| Cassini VIMS | [Tethys](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Tethys&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9348 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
