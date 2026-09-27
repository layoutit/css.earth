# Saturn rings: compare measured opacity profiles

Proposal 96 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Saturn currently uses one Cassini UVIS occultation profile to prepare ring opacity. Proposal 44 concerns spectral interpretation; it does not cover a comparison of dated occultation profiles.

Prepare a small set of measured radial profiles with instrument, wavelength, event time and uncertainty, using the existing chart and ring preparation contracts.

Content owners: [saturn](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/saturn/README.md).

## Evidence

OPUS lists Cassini RSS optical-depth profiles and companion geometry/calibration products. The inspected K-band label identifies calibrated optical depth and phase shift over 72,001.25–144,998.75 km. UVIS, VIMS and Voyager occultations are separate instrument families.

## Work

Choose events with useful radial coverage; decode their native tables and quality limits; reconcile ring radius and event-time conventions. Keep optical depth distinct from display alpha and from the brightness spectra in proposal 44.

## Limits and prior decisions

Different wavelengths, opening angles and epochs cannot be pooled into one measured profile. A single occultation samples a path, not every longitude. Do not infer complete azimuthal structure or change retained ring geometry.

## Acceptance

Verify native table values, radius ordering, missingness, uncertainty and the optical-depth-to-transmission conversion. Demonstrate a useful change against the currently selected UVIS profile; keep preparation and rendering separate.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [co-rss-occ-2005-123-rev007-k26-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+RSS&target=Saturn+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 2005-05-03T02:49:00.202. [Read native label](../evidence/labels/saturn-opacity.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/CORSS_8xxx/CORSS_8001/data/Rev007/Rev007I/Rev007I_RSS_2005_123_K26_I/RSS_2005_123_K26_I_TAU_01KM.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

23 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini CIRS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 31656 | qualification |
| Cassini ISS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 113394 | qualification |
| Cassini RSS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+RSS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 204 | qualification |
| Cassini UVIS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 8250 | qualification |
| Cassini UVIS | [Star](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Star&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3378 | event-review |
| Cassini UVIS | [Sun](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Sun&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 317 | event-review |
| Cassini VIMS | [Alp PsA (Fomalhaut)](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Alp+PsA+%28Fomalhaut%29&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 897 | event-review |
| Cassini VIMS | [Alp Vir (Spica)](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Alp+Vir+%28Spica%29&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 128 | event-review |
| Cassini VIMS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 161187 | qualification |
| Cassini VIMS | [Sun](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Sun&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 80316 | event-review |
| ESO La Silla 1m | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=ESO+La+Silla+1m&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| ESO La Silla 2.2m | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=ESO+La+Silla+2.2m&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Hubble NICMOS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 156 | qualification |
| Hubble STIS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 20 | qualification |
| Hubble WFPC2 | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 195 | qualification |
| IRTF 3.2m | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=IRTF+3.2m&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Lick Anna L Nickel 1m | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Lick+Anna+L+Nickel+1m&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| McDonald Harlan J Smith 2.7m | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=McDonald+Harlan+J+Smith+2.7m&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Palomar Hale 5.08m | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Palomar+Hale+5.08m&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Voyager ISS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2219 | qualification |
| Voyager PPS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+PPS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | qualification |
| Voyager RSS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+RSS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Voyager UVS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+UVS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
