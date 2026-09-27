# Pluto, Ceres and Vesta: qualify historical telescope maps

Proposal 56 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Spacecraft maps already provide better spatial detail. Historical telescope observations would only add a supported epoch or wavelength comparison.

Determine whether one historical observing set supports a useful dated map or whole-object observation within current controls.

Content owners: [pluto](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/pluto/README.md), [ceres](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ceres/README.md), [vesta](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/vesta/README.md)

## Evidence

Photojournal contains Hubble maps of Pluto and Vesta; PDS4 contains historical HST Ceres products. Different inversions and resolutions prevent a direct pixel-by-pixel change claim.

## Work

Recover original products and reconstruction assumptions, compare on common support/resolution, and preserve observation dates separately from publication dates.

## Limits and prior decisions

Do not sharpen old telescope maps with later spacecraft detail or infer surface change from different image-processing methods. No automatic replacement of current global maps.

## Acceptance

Original product and method availability, effective resolution, geometry and calibration consistency. Keep an evidence-only result if a faithful comparison cannot be made.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/hst.ast-ceres.images-albedo-shape_V1_0/bundle_hst.ast-ceres.images-albedo-shape.xml)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-plutos-surface/)
- [NASA source page](https://science.nasa.gov/photojournal/pj-asteroid-or-mini-planet-hubble-maps-the-ancient-surface-of-vesta/)
- [NASA source page](https://science.nasa.gov/photojournal/new-hubble-maps-of-pluto-show-surface-changes/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00826](https://science.nasa.gov/photojournal/map-of-plutos-surface/) | candidate | Hubble FOC rotational reconstruction could add an early Pluto epoch, conditional on recovery of the inversion and effective resolution. |
| [PIA17467](https://science.nasa.gov/photojournal/pj-asteroid-or-mini-planet-hubble-maps-the-ancient-surface-of-vesta/) | candidate | Hubble Vesta 24-image rotation sequence resolves roughly 80 km features; historical observation value is conditional on native calibration and effective-resolution disclosure. |
| [PIA18179](https://science.nasa.gov/photojournal/new-hubble-maps-of-pluto-show-surface-changes/) | candidate | Hubble 2002–2003 Pluto reconstruction is a historical epoch lead with multiple display longitudes; original inversion and support are required for any change comparison. |

PDS bundle IDs: `urn:nasa:pds:hst.ast-ceres.images-albedo-shape`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

7 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 65 | qualification |
| Hubble ACS | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 438 | qualification |
| Hubble NICMOS | [Charon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Charon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 144 | qualification |
| Hubble NICMOS | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 72 | qualification |
| Hubble STIS | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | qualification |
| Hubble WFC3 | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1587 | qualification |
| Hubble WFPC2 | [Pluto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Pluto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 215 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
