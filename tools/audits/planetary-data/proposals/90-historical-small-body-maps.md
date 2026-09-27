# Small bodies: qualify historical map observations

Proposal 90 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Many represented bodies already have better spacecraft maps. The collection title alone does not establish missing data.

Identify individual historical map sheets or photographic observations that add a useful epoch, footprint or source interpretation to an existing package.

Content owners: Determine the existing content owner during source qualification.

## Evidence

The Stooke archive contains 270 map sheets covering six asteroids, five satellites and three comets; the Thomas collection also includes image mosaics.

## Work

Inventory each sheet's underlying observations, projection and target ID, compare it with selected current maps, and keep a named acceptance or rejection for every proposed addition.

## Limits and prior decisions

No automatic new-body count, replacement geometry or reinterpretation of a cartographic reconstruction as a resolved photograph. Map-sheet counts are not unique observations.

## Acceptance

Original image lineage, coordinate support, current-source overlap, source reuse terms and measurable incremental value.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/ast-sat.thomas.shape-models_V1_0/bundle_ast-sat.thomas.shape-models.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.maps/bundle_small_bodies.stooke.maps.xml)

PDS bundle IDs: `urn:nasa:pds:ast-sat.thomas.shape-models`, `urn:nasa:pds:small_bodies.stooke.maps`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

12 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Galileo SSI | [Adrastea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Adrastea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 16 | qualification |
| Galileo SSI | [Amalthea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Amalthea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 39 | qualification |
| Galileo SSI | [Gaspra](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Gaspra&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 154 | qualification |
| Galileo SSI | [Ida](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Ida&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 104 | qualification |
| Galileo SSI | [Metis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Metis&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 20 | qualification |
| Galileo SSI | [Thebe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Thebe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 33 | qualification |
| Hubble ACS | [Adrastea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Adrastea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 51 | qualification |
| Hubble ACS | [Metis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Metis&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 68 | qualification |
| Voyager ISS | [Adrastea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Adrastea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 4 | qualification |
| Voyager ISS | [Amalthea](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Amalthea&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 98 | qualification |
| Voyager ISS | [Metis](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Metis&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 6 | qualification |
| Voyager ISS | [Thebe](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Thebe&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 8 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
