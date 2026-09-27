# Nebulae: calibrated infrared image layers

Proposal 76 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The reviewed products have not been matched to an existing image-layer package or scientifically qualified by this audit.

Qualify measured infrared bands for the California Nebula and Cygnus X through an existing image-layer contract where supported.

Content owners: Determine the existing content owner during source qualification.

## Evidence

PIA23650 shows Spitzer dust emission; PIA26748 identifies SPHEREx water-ice and carbon-bearing spectral signatures in Cygnus X.

## Work

Recover native calibrated images or cubes, WCS, band definitions, errors and masks; compare any existing target inputs before preparing additional layers.

## Limits and prior decisions

These are projected measurements. No invented depth, volumetric nebula reconstruction or renderer change. Spectral signatures are not automatically abundance maps.

## Acceptance

Native availability, WCS registration, units, common band footprint and independent sample comparisons.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/spitzer-california-nebula-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/nasas-spherex-mission-maps-water-ice-throughout-cygnus-x/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA23650](https://science.nasa.gov/photojournal/spitzer-california-nebula-mosaic/) | candidate | Spitzer January 2020 California Nebula mosaic offers measured infrared dust imagery; recover calibrated channels/WCS and use existing image content without inferring unsupported 3D structure. |
| [PIA26748](https://science.nasa.gov/photojournal/nasas-spherex-mission-maps-water-ice-throughout-cygnus-x/) | candidate | SPHEREx Cygnus X ice/PAH signatures are actual spectral-map leads; original calibrated data, WCS, masks and interpretation are required without invented volume geometry. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

10 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Galileo SSI | [Pleiades](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Pleiades&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 85 | qualification |
| Hubble WFC3 | [Necklace Nebula](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFC3&target=Necklace+Nebula&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 24 | qualification |
| New Horizons LORRI | [M7](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=M7&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4 | qualification |
| New Horizons LORRI | [NGC 3532](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=NGC+3532&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 74 | qualification |
| New Horizons LORRI | [Variable Stars in Milky Way Bulge](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Variable+Stars+in+Milky+Way+Bulge&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 40 | qualification |
| New Horizons MVIC | [M7](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=M7&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 36 | qualification |
| Voyager ISS | [Orion](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Orion&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 23 | qualification |
| Voyager ISS | [Pleiades](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Pleiades&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 23 | qualification |
| Voyager ISS | [Scorpius](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Scorpius&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 23 | qualification |
| Voyager ISS | [Taurus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Taurus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 45 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
