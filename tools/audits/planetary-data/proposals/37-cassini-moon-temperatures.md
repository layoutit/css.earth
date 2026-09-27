# Phoebe, Iapetus and Enceladus: measured heat radiation

Proposal 37 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Reflectivity and infrared/ice data already exist on these moons. This proposal concerns CIRS heat measurements, separate from Enceladus VIMS work in the other chat.

Prepare selected dated CIRS temperature products and local-time comparisons, with one coherent source-qualified outcome per moon.

Content owners: [phoebe](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/phoebe/README.md), [iapetus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/iapetus/README.md), [enceladus](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/enceladus/README.md)

## Evidence

The supplied pages show Phoebe flyby temperatures, Iapetus dark-side temperatures and Enceladus south-polar heat. They include unobserved areas, model comparisons and different spatial footprints.

## Work

Obtain original CIRS measurements, footprints and uncertainties. Separate observed heat from predicted solar temperatures; choose only observations with useful coverage.

## Limits and prior decisions

Different local times cannot be merged into a simultaneous global map. The Iapetus curve is not a spatial raster. Do not animate geysers or modify geometry.

## Acceptance

Numeric temperature/brightness checks, explicit local time, measurement/model distinction, footprint masks and current-source overlap. Split implementation by moon if independent qualification outcomes differ.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/phoebe-temperature-maps/)
- [NASA source page](https://science.nasa.gov/photojournal/enceladus-temperature-map/)
- [NASA source page](https://science.nasa.gov/photojournal/iapetus-temperature-map/)
- [NASA source page](https://science.nasa.gov/photojournal/iapetus-temperature-variation-map/)
- [NASA source page](https://science.nasa.gov/photojournal/stripes-and-heat-map-side-by-side/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA06403](https://science.nasa.gov/photojournal/phoebe-temperature-maps/) | candidate | Phoebe CIRS montage is a local-time temperature sequence with unobserved areas; recover numeric maps instead of merging them into a simultaneous globe. |
| [PIA06432](https://science.nasa.gov/photojournal/enceladus-temperature-map/) | candidate | Enceladus south-polar CIRS heat observation is distinct from the predicted solar-temperature panel; observed and modeled fields must remain separate. |
| [PIA07005](https://science.nasa.gov/photojournal/iapetus-temperature-map/) | candidate | Iapetus December 2004 CIRS temperature map records local illumination and dark/bright terrain differences; preserve time and measured footprint. |
| [PIA07006](https://science.nasa.gov/photojournal/iapetus-temperature-variation-map/) | candidate | Iapetus temperature-versus-local-time plot compares measurements with a thermal-inertia model; suitable as qualified chart data, not an additional spatial map. |
| [PIA10360](https://science.nasa.gov/photojournal/stripes-and-heat-map-side-by-side/) | candidate | Enceladus comparison shows earlier south-polar thermal footprints and a later flyby outline; preserve observation dates instead of assuming the whole plate is March 2008 data. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

16 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini CIRS | [Calypso](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Calypso&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3 | qualification |
| Cassini CIRS | [Dione](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Dione&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1970 | qualification |
| Cassini CIRS | [Enceladus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Enceladus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 3403 | qualification |
| Cassini CIRS | [Epimetheus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Epimetheus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 26 | qualification |
| Cassini CIRS | [Helene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Helene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 22 | qualification |
| Cassini CIRS | [Hyperion](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Hyperion&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 309 | qualification |
| Cassini CIRS | [Iapetus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Iapetus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1214 | qualification |
| Cassini CIRS | [Janus](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Janus&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 102 | qualification |
| Cassini CIRS | [Mimas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Mimas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 841 | qualification |
| Cassini CIRS | [Pallene](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Pallene&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2 | qualification |
| Cassini CIRS | [Pandora](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Pandora&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 20 | qualification |
| Cassini CIRS | [Phoebe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Phoebe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 618 | qualification |
| Cassini CIRS | [Polydeuces](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Polydeuces&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 12 | qualification |
| Cassini CIRS | [Rhea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Rhea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2866 | qualification |
| Cassini CIRS | [Telesto](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Telesto&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 10 | qualification |
| Cassini CIRS | [Tethys](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Tethys&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1504 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
