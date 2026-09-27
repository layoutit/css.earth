# Neptune rings: measured radial profiles and dated arc observations

Proposal 98 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Current Neptune ring radii are sourced, but arc centres and widths remain schematic because the selected summary table does not establish absolute positions.

Qualify native occultation profiles and calibrated Voyager/Hubble observations as separate constraints on the existing ring presentation.

Content owners: [neptune](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/neptune/README.md).

## Evidence

OPUS provides Voyager PPS/UVS ring occultations and ISS calibrated/geometrically corrected images. The first inspected PPS segment covers only 42,500–49,999 km: it does not measure the Adams arcs near 62,933 km.

## Work

Read every segment associated with the selected occultation and choose actual arc imaging by event time, phase and ring longitude. Retain a separate table of what each source measures. Use only source-supported fixed-epoch arc locations or an existing prepared chart.

## Limits and prior decisions

A radial occultation cannot locate every arc. Do not expand the inspected inner-ring segment to the Adams ring, fill unseen longitudes, animate arcs or alter scene geometry.

## Acceptance

Independently verify radius/longitude frames and timing, resolve actual arc coverage from native images, and compare with the current schematic assumptions. A profile-only result must be labeled as such.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [vg-pps-2-n-occ-1989-236-sigsgr-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+PPS&target=Neptune+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1989-08-24T22:56:46.860. [Read native label](../evidence/labels/neptune-opacity.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VG_28xx/VG_2801/EASYDATA/KM001/PN1P0104.LBL).
- [vg-iss-2-n-c1060649](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Neptune+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1989-07-30T01:08:34.560. [Read native label](../evidence/labels/neptune-arcs.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_8xxx/VGISS_8204/DATA/C10606XX/C1060649_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

4 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Hubble ACS | [Neptune Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Neptune+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 138 | qualification |
| Voyager ISS | [Neptune Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Neptune+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 798 | qualification |
| Voyager PPS | [Neptune Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+PPS&target=Neptune+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | qualification |
| Voyager UVS | [Neptune Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+UVS&target=Neptune+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
