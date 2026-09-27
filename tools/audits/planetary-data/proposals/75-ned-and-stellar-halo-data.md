# NED and the stellar halo: qualify catalogue measurements

Proposal 75 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The audit has not yet joined these observations to the existing catalogue packages.

Identify a bounded set of genuinely missing catalogue facts or prepared statistical content backed by the original survey.

Content owners: Determine the existing content owner during source qualification.

## Evidence

PIA21084 shows NED galaxy distribution; PIA24571 depicts an inferred outer Milky Way halo density structure. Their pictures are not ready three-dimensional scene assets.

## Work

Find original row identifiers, distance uncertainties and selection functions, cross-match current entries, and select only supported facts or existing-chart results.

## Limits and prior decisions

No unbounded catalogue import, false depth from image pixels or renderer/world redesign. Native product access and incremental value remain unverified.

## Acceptance

Stable IDs, coordinate/distance conventions, population selection, uncertainty and row-level before/after changes.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/ned-catalog-sky-source-map/)
- [NASA source page](https://science.nasa.gov/photojournal/star-map-of-the-milky-ways-outer-halo/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA21084](https://science.nasa.gov/photojournal/ned-catalog-sky-source-map/) | candidate | NED density graphic points to an extragalactic catalogue, not a literal galaxy texture; inspect original IDs/measurements and current catalogue support before any content addition. |
| [PIA24571](https://science.nasa.gov/photojournal/star-map-of-the-milky-ways-outer-halo/) | candidate | Outer-halo stellar-density map is an inferred population field over a distance shell; recover the source star catalogue, selection function and uncertainties instead of a literal 3D texture. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
