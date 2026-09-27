# Asteroids: measured radar Doppler spectra

Proposal 95 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Radar shape models and optical reflectance spectra do not preserve the measured radar echo profiles in this archive.

Qualify selected original Doppler profiles for existing bodies through the current chart or factual-content contract.

Content owners: Determine the existing content owner during source qualification.

## Evidence

The PDS4 bundle identifies comma-separated Arecibo Doppler spectra associated with Virkki et al. (2022). These are whole-target echo measurements, not surface photographs.

## Work

Join target and observation IDs, record transmit frequency, polarization, Doppler convention, normalization and noise, and compare current radar-property facts before adding a representative profile.

## Limits and prior decisions

Do not turn echo frequency into a surface longitude or infer material abundance from radar brightness. A shape inversion is a separate model, outside this proposal.

## Acceptance

Native numeric samples, Doppler units/sign, polarization channels, calibration/noise and a faithful existing-chart presentation.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [PDS source record](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.radar.arecibo.doppler_spectra_of_asteroids_v1.1/bundle_gbo.ast.radar.arecibo.doppler_spectra_of_asteroids.xml)

PDS bundle IDs: `urn:nasa:pds:gbo.ast.radar.arecibo.doppler_spectra_of_asteroids`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
