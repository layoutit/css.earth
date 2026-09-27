# Enceladus: measured ultraviolet occultation light curves

Proposal 109 · **Qualification first** · Priority 3

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

The merged Enceladus VIMS mosaic concerns surface infrared data. UVIS occultation light curves could explain a different measurement without adding plume rendering.

Qualify selected normalized stellar light curves and, only with an independently supported retrieval, plume column-density values in existing prepared chart content.

Content owners: [enceladus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/enceladus/README.md).

## Evidence

The OPUS UVIS HSP query with Enceladus geometry returns raw time series. A body in the geometric field of view does not identify a plume occultation; event classification and reference-star/background measurements remain required.

## Work

Match candidate events to published occultation analyses and original time series. Establish line-of-sight paths, stellar baseline, instrumental flags and uncertainty before any absorption retrieval.

## Limits and prior decisions

Do not convert surface VIMS color into plume activity or infer a global/animated plume from a light curve. This proposal does not reopen the completed VIMS mosaic or change geometry.

## Acceptance

Independently verify timing, normalization, background and retrieval assumptions. Preserve non-detections and uncertainty; use the existing chart contract or keep an evidence-backed source decision.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [co-uvis-hsp2005_048_03_27](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&surfacegeometrytargetname=Enceladus&COUVISchannel=HSP&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Time Series, Optical Depth, 2005-02-17T03:27:37.431. [Read native label](../evidence/labels/enceladus-occultation.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/COUVIS_0xxx/COUVIS_0010/DATA/D2005_048/HSP2005_048_03_27.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

7 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini UVIS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4965 | qualification |
| Cassini UVIS | [Star](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Star&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3378 | event-review |
| Cassini UVIS | [Sun](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Sun&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 317 | event-review |
| Cassini VIMS | [Alp PsA (Fomalhaut)](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Alp+PsA+%28Fomalhaut%29&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 897 | event-review |
| Cassini VIMS | [Alp Vir (Spica)](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Alp+Vir+%28Spica%29&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 128 | event-review |
| Cassini VIMS | [Sun](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Sun&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 80316 | event-review |
| Hubble STIS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 22 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
