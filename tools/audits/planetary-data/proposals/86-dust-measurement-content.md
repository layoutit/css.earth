# Moon and giant-planet systems: measured dust observations

Proposal 86 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

These detector and infrared measurements were outside the original surface-map shortlist. They may support existing chart or factual content without changing rendering.

Qualify a small set of published dust-flux, particle-distribution or infrared-brightness measurements, with separate source decisions for each observing system.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md), [saturn](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/saturn/README.md), [jupiter](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/jupiter/README.md)

## Evidence

CDA/HRD, Galileo DDS, LADEE LDEX, Ulysses and MSX measure different particle or line-of-sight quantities; their archives are independently listed in PDS4.

## Work

Start from calibrated or published derived products, retain detection efficiency, spacecraft position, viewing direction, time and uncertainty, and identify an existing content owner.

## Limits and prior decisions

No fabricated surface dust map, animated particles or three-dimensional density inferred directly from a detector count. A source without a faithful current-contract presentation remains an evidence-only result.

## Acceptance

Counts versus physical flux, calibration/selection effects, geometry, uncertainty and useful source-backed facts or charts.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/cassini_cda_v1.0/bundle_cassini_cda.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/cassini/cassini_high_rate_detector/bundle_cassini_high_rate_detector.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/galileo/galileo-dds/bundle_galileo-dds.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/ldex/ladee_ldex_20240411/bundle_ladee_ldex.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/msx/msx.zody.dust/bundle.msx.zody.dust.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/ulysses/ulysses.udds/bundle_ulysses.udds.xml)

PDS bundle IDs: `urn:nasa:pds:cassini_cda`, `urn:nasa:pds:cassini_high_rate_detector`, `urn:nasa:pds:galileo-dds`, `urn:nasa:pds:ladee_ldex`, `urn:nasa:pds:msx.zody.dust`, `urn:nasa:pds:ulysses-udds`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

2 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini VIMS | [Dust](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Dust&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 176 | qualification |
| New Horizons LORRI | [Dust](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Dust&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 32 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
