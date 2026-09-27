# Pluto and Charon: native MVIC spectral bands

Proposal 105 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Current enhanced-color displays combine MVIC filters. Native individual measurements could provide useful band comparisons beyond those display composites.

Qualify selected blue, red, near-infrared and methane-filter observations on the existing surfaces, grouped with the existing selector.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/pluto/README.md), [charon](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/charon/README.md).

## Evidence

OPUS returns calibrated MVIC SCI products. Their labels explicitly say the absolute-calibration step does not convert stored calibrated DN to physical units. The Charon intended-target sample is from 2012, so it cannot stand in for resolved 2015 flyby coverage.

## Work

Locate the actual encounter scans, including Charon observations indexed under another intended target. Bind filter identities, scan timing and physical-unit conversion; use published geometry/control against current mosaics.

## Limits and prior decisions

OPUS does not supply enhanced MVIC surface geometry in this audit. Four differently colored arrays alone do not establish composition or independent spatial information. Do not substitute 2012 point-source frames for resolved encounter scans.

## Acceptance

Verify calibration constants, band registration, scan geometry, masks and native sampling against independent values and landmarks. Name reflectance/band ratios honestly and avoid duplicating enhanced color.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [nh-mvic-mp1_0299137933](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Pluto&time1=2015-07-14&time2=2015-07-15&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 2015-07-14T00:00:21.007. [Read native label](../evidence/labels/pluto-bands.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPEMV_2001/data/20150714_029913/mp1_0299137933_0x530_sci.lbl).
- [nh-mvic-mpf_0200906396](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Charon&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 2012-06-02T01:28:01.010. [Read native label](../evidence/labels/charon-bands.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/NHxxMV_xxxx/NHPCMV_2001/data/20120602_020090/mpf_0200906396_0x539_sci.lbl).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

4 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| New Horizons LORRI | [Charon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Charon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 537 | qualification |
| New Horizons LORRI | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 5378 | qualification |
| New Horizons MVIC | [Charon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Charon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 8 | qualification |
| New Horizons MVIC | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 527 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
