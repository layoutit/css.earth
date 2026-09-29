# EPIC 246489089

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.88 solar masses and 10.1 solar radii; APOGEE spectra give 5,026 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2645782425082965376, distance 2,542 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246489089 (K2 campaign 12): PARAM asteroseismic distance (pc) 2541.972656 (16th-84th percentiles 2498.164062-2587.851562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.406 ± 0.015 mas (28.0 standard errors), is not used. Radius 10.1455 +/- 0.2697 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246489089 (K2 campaign 12): PARAM radius (solar radii) 10.145504 (16th-84th percentiles 9.896261-10.435668), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8796 +/- 0.0486 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246489089 (K2 campaign 12): PARAM mass (solar masses) 0.879601 (16th-84th percentiles 0.834856-0.932086), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,026 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246489089: APOGEE DR17 effective temperature 5026.3647 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 5,026 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,026 K and log g 2.37 (u1 0.616, u2 0.156): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
