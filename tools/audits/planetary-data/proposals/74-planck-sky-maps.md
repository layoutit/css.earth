# Planck: qualified all-sky scientific maps

Proposal 74 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

The audit has not established a compatible current all-sky prepared content path for these three quantities.

Qualify native CMB, lensing and polarized-dust data and identify a faithful existing image or catalogue presentation before any integration.

Content owners: Determine the existing content owner during source qualification.

## Evidence

PIA16873, PIA16875 and PIA18048 concern temperature anisotropy, inferred lensing matter and polarized dust respectively.

## Work

Obtain official numeric HEALPix releases with units, masks, coordinates and uncertainty; reduce to supported prepared content offline only if the present contract permits it.

## Limits and prior decisions

A sky map is not a planet texture. Lensing is an inference, and dust polarization is not a three-dimensional magnetic field. No renderer or world-ownership changes.

## Acceptance

Official product identity, coordinate transformations, numeric samples, uncertainty and current-contract fit. If no fit exists, the PR is a source qualification record only.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/best-map-ever-of-the-universe/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-matter-in-the-universe/)
- [NASA source page](https://science.nasa.gov/photojournal/magnetic-map-of-milky-way/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA16873](https://science.nasa.gov/photojournal/best-map-ever-of-the-universe/) | candidate | Planck CMB temperature anisotropy is a real all-sky numeric-map lead; original HEALPix data, masks and an existing compatible display contract must be verified. |
| [PIA16875](https://science.nasa.gov/photojournal/map-of-matter-in-the-universe/) | candidate | Planck lensing/matter reconstruction is distinct from the CMB temperature map and contains masked Galactic regions; retain model interpretation and uncertainty. |
| [PIA18048](https://science.nasa.gov/photojournal/magnetic-map-of-milky-way/) | candidate | Planck polarized dust map constrains projected magnetic orientation; recover Stokes/uncertainty data and avoid calling drawn streamlines measured 3D field lines. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)
