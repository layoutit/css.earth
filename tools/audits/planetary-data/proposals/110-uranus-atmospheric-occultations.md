# Uranus: observed atmospheric occultation light curves

Proposal 110 · **Qualification first** · Priority 3

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Uranus currently explains its atmosphere using model-based charts. The ring archive also contains separately labeled atmospheric occultation measurements.

Prepare an observed stellar-flux curve alongside an accurately described atmospheric explanation using existing chart support.

Content owners: [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md).

## Evidence

The read HST FOS PDS4 label identifies normalized stellar flux versus time during the 16 March 1996 atmospheric egress. It supplies time coordinates, sky-plane radius and flags, not a measured temperature-pressure grid.

## Work

Decode the original calibrated table and quality record; compare ground-based events where compatible. Keep any later atmospheric inversion a separately justified model with explicit assumptions.

## Limits and prior decisions

Do not relabel the API Optical Depth facet as a ready atmospheric temperature measurement. A single occultation samples one path and epoch, not the whole atmosphere.

## Acceptance

Check time systems, normalization and quality flags against native rows. Distinguish observed light loss from any derived density/temperature and preserve uncertainties.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [hst-fos-occ-1996-076-u137-uranus-e](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+FOS&target=Uranus&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Occultation Profile, Optical Depth, 1996-03-16T15:25:38.144. [Read native label](../evidence/labels/uranus-atmosphere.xml) · [Original label](https://opus.pds-rings.seti.org/pds4-holdings/bundles/uranus_occs_earthbased/uranus_occ_u137_hst_fos/data/atmosphere/u137_hst_fos_540nm_counts-v-time_atmos_egress.xml).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

14 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cerro Tololo SMARTS 1.5m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cerro+Tololo+SMARTS+1.5m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Cerro Tololo Victor Blanco 4m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cerro+Tololo+Victor+Blanco+4m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 7 | qualification |
| ESO La Silla 3.6m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=ESO+La+Silla+3.6m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | qualification |
| Hubble FOS | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+FOS&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | qualification |
| IRTF 3.2m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=IRTF+3.2m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 11 | qualification |
| Kuiper Airborne Observatory 0.91m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Kuiper+Airborne+Observatory+0.91m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Las Campanas Henrietta Swope 1.0m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Las+Campanas+Henrietta+Swope+1.0m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Las Campanas Irenee Dupont 2.5m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Las+Campanas+Irenee+Dupont+2.5m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Lowell Perkins 1.83m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Lowell+Perkins+1.83m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Mount Stromlo 1.9m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Mount+Stromlo+1.9m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Palomar Hale 5.08m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Palomar+Hale+5.08m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | qualification |
| SAAO Radcliffe 1.88m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=SAAO+Radcliffe+1.88m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4 | qualification |
| SSO AAT 3.9m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=SSO+AAT+3.9m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Teide Carlos Sanchez 1.55m | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Teide+Carlos+Sanchez+1.55m&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
