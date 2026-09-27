# Uranus: a dated Voyager cloud observation

Proposal 102 · **Qualification first** · Priority 2

Compared with [cssEarth f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3) on 27 September 2026. This is proposed work, not a qualified dataset.

## Problem and proposed result

Uranus already has dated OPAL maps. A Voyager-era view would extend the time baseline only if it is reconstructed from a coherent observation set.

Qualify one dated 1986 cloud/filter dataset through the existing surface/date selector.

Content owners: [uranus](https://github.com/layoutit/css.earth/blob/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3/src/objects/uranus/README.md).

## Evidence

OPUS exposes thousands of Uranus ISS records with calibrated and geometrically corrected products. The resolution-ranked example crosses incidence angles above 90 degrees and approaches the limb; nominally fine sampling is not sufficient selection evidence.

## Work

Choose a near-contemporaneous filter set using illumination, disk placement and resolution together. Use the native calibration and camera geometry, retaining missing polar/limb coverage and acquisition times.

## Limits and prior decisions

No mixing decades or unseen hemispheres; no inferred high-detail clouds. A Voyager false-color view must not imply absolute brightness comparability with contrast-enhanced OPAL displays.

## Acceptance

Check independent limb/feature registration, inter-band timing, source sampling and visible coverage. Use an honest dated regional result if a coherent global view is unsupported.

Follow the [shared scope](contract.md): fixed current moon geometry, shared renderer/camera/shell, existing selectors and source labels. All decoding and preparation happen offline.

## Examined source products

- [vg-iss-2-u-c2686312](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Uranus&surfacegeometrytargetname=Uranus&SURFACEGEOuranus_centerresolution1=0.000001&order=SURFACEGEOuranus_centerresolution1%2Copusid&cols=opusid%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cquantity%2Cobservationtype&limit=1): Image, Reflectivity, 1986-01-25T06:15:56.280. [Read native label](../evidence/labels/uranus-voyager.lbl) · [Original label](https://opus.pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26863XX/C2686312_CALIB.LBL).

The product snapshot and exact queries are in [OPUS evidence](../evidence/opus.json). Labels and file listings were read; pixel arrays and full physical retrievals were not qualified in this audit.

<!-- opus:start -->
## OPUS extension: 27 September 2026

6 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Hubble ACS | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 764 | qualification |
| Hubble WFC3 | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 787 | qualification |
| Hubble WFPC2 | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 658 | qualification |
| New Horizons LORRI | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | qualification |
| New Horizons MVIC | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 8 | qualification |
| Voyager ISS | [Uranus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Uranus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4944 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
