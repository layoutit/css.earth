# Itokawa: calibrated near-infrared spectra

Proposal 82 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

AMICA photographic bands do not supply the NIRS spectral measurements.

Qualify a useful measured spectrum first, followed by a regional spectral-signature map only if native geometry supports it.

Content owners: [itokawa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/itokawa/README.md)

## Evidence

The archive distinguishes 117,937 raw spectra from 111,226 calibrated Itokawa spectra. Other targets and calibration frames must not be mistaken for asteroid coverage.

## Work

Read original wavelength/calibration records, select target and epoch, preserve quality and uncertainty, and join observation geometry before assessing spatial coverage.

## Limits and prior decisions

Spectrum counts are not independent resolved surface cells. Do not infer mineral abundance or use AMICA texture detail to sharpen a NIRS footprint.

## Acceptance

Target filtering, native radiometric samples, wavelength order, uncertainty, footprint and current chart/map feasibility.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/hayabusa/hay.nirs/bundle_hay.nirs.xml)

PDS bundle IDs: `urn:nasa:pds:hay.nirs`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
