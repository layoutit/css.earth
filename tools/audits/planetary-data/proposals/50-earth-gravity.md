# Earth: monthly gravity changes from GRACE

Proposal 50 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The existing Earth package does not establish this monthly gravity-anomaly series.

A compact source-qualified set of GRACE gravity changes, or an explicitly interpreted mass-equivalent product if that is the selected release.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md)

## Evidence

PIA22448 describes near-monthly gravity-anomaly maps from April 2002 to June 2017; it does not provide the full numeric interpretation contract.

## Work

Identify a versioned official solution, its reference interval, corrections, masks and uncertainties. Prepare a declared sequence through the existing date selector.

## Limits and prior decisions

Do not interchange gravity anomaly and water-equivalent thickness. Spatial smoothing and missing months matter; the press animation alone is insufficient.

## Acceptance

Independent monthly samples, reference mean, leakage/smoothing treatment, unit labels and no interpolation disguised as observations.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/monthly-grace-gravity-anomaly-maps/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA22448](https://science.nasa.gov/photojournal/monthly-grace-gravity-anomaly-maps/) | candidate | GRACE monthly gravity anomalies from 2002–2017 are a substantial time-series lead; original grids, corrections and units must replace the animation frames. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
