# Ryugu: MASCOT's local temperature measurements

Proposal 84 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Global thermal inertia does not represent the lander's local thermal time series.

Qualify a local temperature curve or measured thermal facts using existing chart content, with the landing-site context retained.

Content owners: [ryugu](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/ryugu/README.md)

## Evidence

The archive contains MASCOT MARA radiometer observations and separate bus records that can support timing and state interpretation.

## Work

Read instrument calibration, channel responses, pointing and lander states; isolate the usable surface intervals and preserve uncertainty.

## Limits and prior decisions

Do not extrapolate a lander-sized measurement across Ryugu or confuse instrument temperature with surface temperature. No surface panorama UI.

## Acceptance

Native time/channel samples, state filtering, footprint/pointing, uncertainty and current chart compatibility.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_mascot_mara/bundle_hyb2_mascot_mara.xml)
- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa2/hyb2_mascot_mbus/bundle_hyb2_mascot_mbus.xml)

PDS bundle IDs: `urn:jaxa:darts:hyb2_mascot_mara`, `urn:jaxa:darts:hyb2_mascot_mbus`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
