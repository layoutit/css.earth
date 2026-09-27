# Jupiter moons: distinguish ultraviolet surface and atmospheric signals

Proposal 101 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

The earlier proposals cover NIMS, photography and volcanic changes. Hubble ultraviolet spectra provide a separate set of measurements requiring their own interpretation.

Prepare selected measured spectra or spatially supported ultraviolet bands with clear labels for reflected light versus atmospheric emission.

Content owners: [io](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/io/README.md), [europa](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/europa/README.md), [ganymede](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/ganymede/README.md), [callisto](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/callisto/README.md).

## Evidence

A targeted Europa STIS query returns native spectrum products, including calibrated 1D and 2D extractions. The archive also contains ACS/STIS/WFPC2 observations of Io, Europa and Ganymede; these are not automatically surface maps.

## Work

Select coherent observing programs, remove acquisition images and calibrations, read aperture/pointing/error products, and match published analyses to exact observation IDs. Use the existing chart contract for spatially unresolved signals.

## Limits and prior decisions

Do not place an auroral or exospheric emission pattern on solid terrain, interpret it as mineral abundance, or combine time-variable emissions into a timeless global surface.

## Acceptance

Check extraction, flux units, wavelength solution, error arrays and observing geometry. Any mapped result needs independent surface registration; otherwise deliver a qualified chart or retain a source decision.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [hst-08224-stis-o5d601010](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Europa&observationtype=Spectrum&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectrum, Emission, 1999-10-05T08:39:27.000. [Read native label](../evidence/labels/europa-ultraviolet.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/HSTOx_xxxx/HSTO0_8224/DATA/VISIT_01/O5D601010.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

14 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini UVIS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 29 | qualification |
| Hubble ACS | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 11 | qualification |
| Hubble ACS | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 96 | qualification |
| Hubble ACS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 341 | qualification |
| Hubble NICMOS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 178 | qualification |
| Hubble STIS | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 173 | qualification |
| Hubble STIS | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 184 | qualification |
| Hubble STIS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 282 | qualification |
| Hubble WFC3 | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 59 | qualification |
| Hubble WFC3 | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 16 | qualification |
| Hubble WFPC2 | [Callisto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Callisto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 15 | qualification |
| Hubble WFPC2 | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 64 | qualification |
| Hubble WFPC2 | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 69 | qualification |
| Hubble WFPC2 | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 332 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
