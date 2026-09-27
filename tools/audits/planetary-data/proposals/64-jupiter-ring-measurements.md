# Jupiter rings: qualify a measured radial profile

Proposal 64 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

A perspective ring photograph does not establish a radius-indexed measurement suitable for the current prepared ring contract.

Determine whether Galileo observations support a calibrated radial brightness profile usable by the existing ring preparation.

Content owners: [jupiter](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/jupiter/README.md)

## Evidence

PIA03001 identifies a backlit Galileo ring mosaic and its observing geometry.

## Work

Recover the original images and geometry, distinguish forward-scattering brightness from optical depth, and assess the current ring asset contract before deriving a profile offline.

## Limits and prior decisions

No renderer or ring-topology changes. A photograph alone cannot establish a three-dimensional dust distribution or opacity law.

## Acceptance

Radius mapping, scattering angle, background subtraction, uncertainty and current-contract feasibility; otherwise record a bounded negative result.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/jovian-ring-system-mosaic/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA03001](https://science.nasa.gov/photojournal/jovian-ring-system-mosaic/) | candidate | Galileo Jupiter ring mosaic measures strongly geometry-dependent scattered light; only a qualified radial/profile outcome fits the unchanged renderer. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

4 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Galileo SSI | [Jupiter Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Jupiter+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 51 | qualification |
| Hubble ACS | [Jupiter Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Jupiter+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 24 | qualification |
| New Horizons LORRI | [Jupiter Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Jupiter+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 517 | qualification |
| Voyager ISS | [Jupiter Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Jupiter+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 30 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
