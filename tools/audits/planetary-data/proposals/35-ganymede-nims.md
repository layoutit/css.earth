# Ganymede: infrared ice and grain-size signatures

Proposal 35 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Ganymede has imaging, geology and an oxygen-signature view. A new NIMS product needs comparison with the existing deferred SPHERE/JWST composition work.

Qualify Galileo NIMS ice-sensitive bands or published grain-size interpretations as measured regional data.

Content owners: [ganymede](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ganymede/README.md)

## Evidence

PIA00500 compares camera imagery with NIMS water-ice and grain/mineral interpretations, but supplies a montage rather than a native scalar grid.

## Work

Identify the original observation cube, geometry, wavelengths, masks and interpretation method; measure useful coverage on the current body.

## Limits and prior decisions

Ice absorption, grain size and abundance are different quantities. Do not assign minerals from press colors or imply global coverage.

## Acceptance

Native cube samples, footprint/landmark registration, spectral uncertainty and explicit distinction from the oxygen dataset.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/nims-ganymede-surface-map/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00500](https://science.nasa.gov/photojournal/nims-ganymede-surface-map/) | candidate | NIMS water-ice and grain/mineral panels are distinct spectral leads; native cubes, quantity definitions and coverage are still required. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

1 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini VIMS | [Ganymede](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Ganymede&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 174 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
