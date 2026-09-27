# Venus: native Galileo and Cassini cloud observations

Proposal 107 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Venus has Magellan surface measurements and Akatsuki ultraviolet clouds. Historical optical/infrared flybys are a different observing opportunity from the rejected sparse radar-look mosaics.

Qualify one coherent dated cloud/filter observation through existing prepared datasets.

Content owners: [venus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/venus/README.md).

## Evidence

Galileo SSI and Cassini ISS/VIMS/UVIS have Venus intended-target records. The inspected Galileo endpoint supplies raw EDR imagery and geometry; calibrated reflectance is not established by that file listing.

## Work

Recover the relevant calibration, verify filter and exposure, and choose a time-consistent observed hemisphere. Register cloud images using atmosphere-appropriate geometry; preserve native resolution and missing coverage.

## Limits and prior decisions

Cloud measurements are not surface geology or global ground coverage. Different wavelengths can probe different altitudes; do not merge moving clouds from separate flybys.

## Acceptance

Independent radiometric and pointing checks, explicit time and bandpass, and a demonstrated useful difference from the current Akatsuki dataset. No inferred unseen cloud texture.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [go-ssi-c0018062600](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Venus&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1990-02-10T05:12:16.682. [Read native label](../evidence/labels/venus-clouds.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/GO_0xxx/GO_0002/VENUS/C0018062600R.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

4 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Venus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Venus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 24 | qualification |
| Cassini UVIS | [Venus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Venus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Cassini VIMS | [Venus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Venus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 246 | qualification |
| Galileo SSI | [Venus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Venus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 81 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
