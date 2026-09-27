# Giant planets: measured ultraviolet and infrared spectra

Proposal 108 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Several current spectrum/atmosphere charts are model outputs. OPUS supplies observed spectra whose purpose and calibration can be compared with those model claims.

Add selected measured spectra to existing prepared charts, labeled by aperture, wavelength and observation time.

Content owners: [jupiter](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/jupiter/README.md), [saturn](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/saturn/README.md), [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md), [neptune](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/neptune/README.md).

## Evidence

The Uranus STIS search has spectrum records and calibrated FITS links. The earliest sample is not automatically a complete disk-integrated reflected-light spectrum; slit placement and emission interpretation require native checks.

## Work

Choose published, coherent programs; recover extraction/error arrays and instrument response. Separate reflected sunlight, thermal radiation and auroral emission. Compare models only at matched geometry and spectral resolution.

## Limits and prior decisions

A spectrum from a slit or limb is not a global atmosphere profile. Raw Hubble inputs overlapping OPAL maps are not additional dates merely because OPUS lists them.

## Acceptance

Validate physical units, aperture, uncertainties, resolution and observed-versus-modeled labels. Render all charts at preparation time through existing content support.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [hst-07439-stis-o4wt03010](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Uranus&observationtype=Spectrum&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Spectrum, Emission, 1998-09-14T05:37:38.000. [Read native label](../evidence/labels/giant-spectra.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/HSTOx_xxxx/HSTO0_7439/DATA/VISIT_03/O4WT03010.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

13 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini CIRS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 22476 | qualification |
| Cassini UVIS | [Jupiter](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Jupiter&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1716 | qualification |
| Cassini UVIS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 109715 | qualification |
| Cassini VIMS | [Jupiter](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Jupiter&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 28583 | qualification |
| Cassini VIMS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 121046 | qualification |
| Hubble NICMOS | [Jupiter](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Jupiter&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 592 | qualification |
| Hubble NICMOS | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 141 | qualification |
| Hubble NICMOS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 102 | qualification |
| Hubble NICMOS | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 336 | qualification |
| Hubble STIS | [Jupiter](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Jupiter&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 464 | qualification |
| Hubble STIS | [Neptune](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Neptune&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 79 | qualification |
| Hubble STIS | [Saturn](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Saturn&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 175 | qualification |
| Hubble STIS | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 242 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
