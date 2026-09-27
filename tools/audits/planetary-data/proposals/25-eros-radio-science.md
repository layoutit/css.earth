# Eros: qualify derived gravity and physical parameters

Proposal 25 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Eros already has an observed shape and elevation. No new gravity map has been qualified by this audit.

Read the derived NEAR radio-science products and determine which gravity or physical facts add information beyond the current package.

Content owners: [eros](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/eros/README.md)

## Evidence

The PDS4 scan located the NEAR RSS derived bundle separately from raw tracking.

## Work

Identify model coefficients, covariance, reference frame and radius; compare selected mass and spin facts before deriving any field offline.

## Limits and prior decisions

Spatial resolving power and reference-density assumptions constrain interpretation. No hidden-structure claims or automatic geometry replacement.

## Acceptance

Reproduce published check values and uncertainty. If no distinct reliable surface field exists, limit the PR to demonstrated fact corrections and the source decision.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/near/near_rss/near_rss_derived/bundle_near_rs_derived.xml)

PDS bundle IDs: `urn:nasa:pds:near_rss_derived`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
