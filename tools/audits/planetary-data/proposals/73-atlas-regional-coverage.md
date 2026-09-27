# Atlas: qualify additional observed ISS coverage

Proposal 73 · **Blocked by existing evidence** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Atlas already uses calibrated 2017 ISS images. Its ledger records a failed 2026 trial where published camera geometry projected about 98% of illuminated pixels onto sky.

Assess the December 2015 anti-Saturn view only if its original frames and authoritative geometry add measured coverage beyond the current set.

Content owners: [atlas](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/atlas/README.md)

## Evidence

PIA17206 identifies a resolved ridge observation. A press portrait does not itself repair the known pointing problem.

## Work

Cross-match observation IDs, obtain original calibrated pixels and independent controlled poses, and compare the footprint with the selected 2017 sources.

## Limits and prior decisions

No guessed pointing adjustment, synthetic far side or replacement shape. Respect the existing press-portrait exclusion until genuinely new pixels or registration are established.

## Acceptance

Original camera solution, independent landmark residuals, new measured area and fixed-geometry preparation.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/atlas-escaping/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA17206](https://science.nasa.gov/photojournal/atlas-escaping/) | candidate | The December 2015 Atlas view is a conditional coverage lead beyond selected 2017 frames. The current ledger records a failed camera-geometry trial; this press image does not repair it, so authoritative native registration is required. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

1 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Atlas](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Atlas&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1473 | prior-limit |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
