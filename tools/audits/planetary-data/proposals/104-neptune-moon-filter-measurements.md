# Neptune moons: qualify useful native filter measurements

Proposal 104 · **Blocked by existing evidence** · Priority 3

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Triton and Proteus already use calibrated Voyager photography and filter color. Proteus still lacks independent interior feature control; Triton retains a documented calibration-scale discrepancy.

Resolve a demonstrated calibration or registration gap before adding a numeric band or genuinely additional observed region. Unresolved small moons can contribute measured photometry, not fabricated textures.

Content owners: [triton](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/triton/README.md), [proteus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/proteus/README.md), [nereid](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/nereid/README.md), [larissa](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/larissa/README.md).

## Evidence

The resolution-ranked Proteus example C1138920 is already a selected source. Its presence in OPUS is duplication, not a newly discovered high-resolution image.

## Work

Compare exact observation IDs and source processing versions first. Follow the existing Triton/Proteus reopen conditions and investigate alternative native products only when they offer new calibration or independent geometric evidence.

## Limits and prior decisions

No new surface from a point source, no repeat of the same unconstrained limb fit, and no geometry changes. Preserve existing native-resolution and missing-coverage limits.

## Acceptance

An independent calibration/control improvement must be demonstrated against the current selected inputs. Otherwise close the candidate as existing-family or unresolved; do not count retrieved copies as new data.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [vg-iss-2-n-c1138920](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Proteus&surfacegeometrytargetname=Proteus&SURFACEGEOproteus_centerresolution1=0.000001&order=SURFACEGEOproteus_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1989-08-25T03:10:19.080. [Read native label](../evidence/labels/proteus-bands.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8207/DATA/C11389XX/C1138920_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

10 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Hubble ACS | [Naiad](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Naiad&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 10 | prior-limit |
| Hubble ACS | [Thalassa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Thalassa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 10 | prior-limit |
| Hubble ACS | [Triton](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Triton&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 144 | prior-limit |
| Hubble NICMOS | [Proteus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Proteus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 26 | prior-limit |
| Hubble STIS | [Triton](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Triton&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | prior-limit |
| New Horizons LORRI | [Triton](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Triton&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 40 | prior-limit |
| Voyager ISS | [Larissa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Larissa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | prior-limit |
| Voyager ISS | [Nereid](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Nereid&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 206 | prior-limit |
| Voyager ISS | [Proteus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Proteus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 42 | prior-limit |
| Voyager ISS | [Triton](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Triton&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 660 | prior-limit |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
