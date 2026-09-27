# Ryugu: dated infrared temperature observations

Proposal 83 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Ryugu already has a modeled thermal-inertia view. Actual dated TIR observations are a different possible addition.

Qualify a compact, useful temperature observing set that preserves local solar time and measured footprint.

Content owners: [ryugu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ryugu/README.md)

## Evidence

The Hayabusa2 TIR bundle contains operational instrument products; the inventory alone does not establish a ready global temperature map.

## Work

Prefer calibrated or derived products, resolve radiance versus brightness temperature, join camera geometry and uncertainty, and prepare a bounded set offline.

## Limits and prior decisions

Thermal inertia and temperature have different units and meanings. No false simultaneous global mosaic from changing illumination.

## Acceptance

Source calibration, time/local time, independent temperatures, registration and a distinct result beyond the current thermal-inertia product.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_tir/bundle_hyb2_tir.xml)

PDS bundle IDs: `urn:jaxa:darts:hyb2_tir`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
