# Uranian moons: qualify numeric Voyager filter measurements

Proposal 103 · **Blocked by existing evidence** · Priority 3

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

All five moons already have Voyager color datasets. A second color composite is duplicate work. The current recipes include whole-disc color matching and no phase normalization.

Assess whether calibrated individual filter values or measured ratios can support a distinct numeric dataset or chart beyond the current display colors.

Content owners: [ariel](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/ariel/README.md), [miranda](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/miranda/README.md), [umbriel](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/umbriel/README.md), [titania](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/titania/README.md), [oberon](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/oberon/README.md).

## Evidence

Native Voyager CALIB/GEOMED products and geometry are accessible. Existing ledgers preserve camera/control limits and the earlier unsuccessful Oberon color trial as well as the subsequently included Voyager color dataset.

## Work

Start from selected observations and their existing registrations. Trace calibration, scaling, phase and uncertainty to the original measurements; inspect additional frames only if they meet an explicit unmet coverage or information requirement.

## Limits and prior decisions

Archive availability does not reopen rejected reconstructions. Do not repeat the old Oberon trial, borrow clear-filter detail, fill the unlit north or change moon geometry.

## Acceptance

Establish physically meaningful units and independent photometric checks. If the available calibration cannot support numeric interpretation beyond the current color display, retain that negative result rather than add another lens.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [vg-iss-2-u-c2684629](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Miranda&surfacegeometrytargetname=Miranda&SURFACEGEOmiranda_centerresolution1=0.000001&order=SURFACEGEOmiranda_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1986-01-24T16:53:31.080. [Read native label](../evidence/labels/miranda-bands.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26846XX/C2684629_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

12 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Hubble ACS | [Mab](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Mab&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 48 | prior-limit |
| Hubble NICMOS | [Puck](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Puck&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 26 | prior-limit |
| Hubble STIS | [Titania](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Titania&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | prior-limit |
| Hubble WFC3 | [Cupid](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Cupid&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9 | prior-limit |
| Hubble WFC3 | [Mab](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Mab&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 197 | prior-limit |
| Hubble WFPC2 | [Mab](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Mab&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 301 | prior-limit |
| Voyager ISS | [Ariel](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Ariel&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 101 | prior-limit |
| Voyager ISS | [Miranda](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Miranda&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 90 | prior-limit |
| Voyager ISS | [Oberon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Oberon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 74 | prior-limit |
| Voyager ISS | [Puck](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Puck&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | prior-limit |
| Voyager ISS | [Titania](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Titania&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 102 | prior-limit |
| Voyager ISS | [Umbriel](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Umbriel&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 100 | prior-limit |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
