# Uranus rings: replace broad opacity assumptions with measured profiles

Proposal 97 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Uranus uses published ring dimensions and broad optical-depth values; the epsilon-ring display uses a midpoint of the published range.

Qualify Voyager and Earth-based occultation profiles for prepared ring-opacity inputs and source-backed explanatory charts.

Content owners: [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md).

## Evidence

The inspected Voyager PPS label supplies ring-intercept radius, normal opacity and uncertainty. The Earth-based PDS4 release supplies radial products at multiple sampling intervals, ring fits and quality ratings. These are native measurements beyond the summary ring table.

## Work

Select dated ingress/egress events with documented ring-plane models and adequate signal. Preserve the native quantity: normalized flux, opacity and optical depth are different. Compare overlapping independent events before changing an existing display parameter.

## Limits and prior decisions

Sampling interval is not spatial resolving power. Narrow-ring eccentricity and longitude variations prohibit averaging all profiles into a supposedly simultaneous circular ring. Keep fixed geometry and disclose any display-width floor.

## Acceptance

Check radius, units, flags, uncertainties, bandpass and conversion against the label and independent numeric rows. Demonstrate that the existing prepared annular texture can represent the result without geometry or renderer changes.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [vg-pps-2-u-occ-1986-024-sigsgr-ringpl-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+PPS&target=Uranus+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1986-01-24T04:38:08.032. [Read native label](../evidence/labels/uranus-opacity.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VG_28xx/VG_2801/EASYDATA/KM000_1/PU1P01XI.LBL).
- [ctio4m0-insb-occ-1980-080-u11-ringpl-i](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cerro+Tololo+Victor+Blanco+4m&target=Uranus+Rings&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1980-03-20T04:00:00.064. [Read native label](../evidence/labels/uranus-ground.xml) · [Original label](https://opus.pds-rings.seti.org/pds4-holdings/bundles/uranus_occs_earthbased/uranus_occ_u11_ctio_400cm/data/global/u11_ctio_400cm_2200nm_radius_equator_ingress_100m.xml).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

27 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Caha Calar Alto 1.23m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Caha+Calar+Alto+1.23m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12 | qualification |
| Cerro Tololo SMARTS 1.5m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cerro+Tololo+SMARTS+1.5m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 18 | qualification |
| Cerro Tololo Victor Blanco 4m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cerro+Tololo+Victor+Blanco+4m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 116 | qualification |
| ESO La Silla 1m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=ESO+La+Silla+1m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 15 | qualification |
| ESO La Silla 2.2m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=ESO+La+Silla+2.2m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 15 | qualification |
| ESO La Silla 3.6m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=ESO+La+Silla+3.6m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 19 | qualification |
| Hubble FOS | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+FOS&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 14 | qualification |
| Hubble NICMOS | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 26 | qualification |
| IRTF 3.2m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=IRTF+3.2m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 166 | qualification |
| Kuiper Airborne Observatory 0.91m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Kuiper+Airborne+Observatory+0.91m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 20 | qualification |
| Las Campanas Henrietta Swope 1.0m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Las+Campanas+Henrietta+Swope+1.0m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12 | qualification |
| Las Campanas Irenee Dupont 2.5m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Las+Campanas+Irenee+Dupont+2.5m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 70 | qualification |
| Lowell Perkins 1.83m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Lowell+Perkins+1.83m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 7 | qualification |
| McDonald Harlan J Smith 2.7m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=McDonald+Harlan+J+Smith+2.7m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 30 | qualification |
| Mount Stromlo 1.9m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Mount+Stromlo+1.9m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 20 | qualification |
| Palomar Hale 5.08m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Palomar+Hale+5.08m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 71 | qualification |
| Pic du Midi 1.06m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Pic+du+Midi+1.06m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 6 | qualification |
| Pic du Midi Bernard Lyot 2.0m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Pic+du+Midi+Bernard+Lyot+2.0m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 13 | qualification |
| SAAO Radcliffe 1.88m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=SAAO+Radcliffe+1.88m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 41 | qualification |
| SSO AAT 3.9m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=SSO+AAT+3.9m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 25 | qualification |
| SSO ANU 2.3m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=SSO+ANU+2.3m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | qualification |
| Teide Carlos Sanchez 1.55m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Teide+Carlos+Sanchez+1.55m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 27 | qualification |
| UKIRT 3.8m | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=UKIRT+3.8m&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 9 | qualification |
| Voyager ISS | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 502 | qualification |
| Voyager PPS | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+PPS&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 28 | qualification |
| Voyager RSS | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+RSS&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 36 | qualification |
| Voyager UVS | [Uranus Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+UVS&target=Uranus+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 6 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
