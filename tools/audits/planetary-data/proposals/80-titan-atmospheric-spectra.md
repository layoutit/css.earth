# Titan: the measured south-polar HCN signature

Proposal 80 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Titan surface VIMS, thermal and geological products do not represent an atmospheric HCN cloud spectrum.

Qualify the observed polar-vortex spectrum as a dated atmospheric measurement using existing chart or factual content.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

## Evidence

PIA18431 identifies hydrogen-cyanide ice in Titan's south-polar atmospheric vortex, a different target and interpretation from surface reflectance.

## Work

Find the original VIMS observation, spectral extraction and reference comparison; retain altitude/limb geometry, date and uncertainty.

## Limits and prior decisions

No surface HCN-abundance map, cloud volume or renderer change. A detection spectrum is not a global atmospheric concentration measurement.

## Acceptance

Original band samples, feature identification, aperture/geometry, observational support and existing chart compatibility.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/spectral-map-of-titan-with-polar-vortex/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA18431](https://science.nasa.gov/photojournal/spectral-map-of-titan-with-polar-vortex/) | candidate | Titan VIMS HCN polar-vortex signal is atmospheric, not surface composition; preserve that distinction and keep any unsupported atmosphere presentation out of delivery. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

3 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini UVIS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 13886 | qualification |
| Cassini VIMS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 115767 | qualification |
| Hubble STIS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 68 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
