# EPIC 212334630

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.86 solar masses and 7.6 solar radii; APOGEE spectra give 4,628 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6295356770903435904, distance 3,104 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212334630 (K2 campaign 6): PARAM asteroseismic distance (pc) 3103.671875 (16th-84th percentiles 3050.664062-3170.625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.267 ± 0.019 mas (14.0 standard errors), is not used. Radius 7.6464 +/- 0.193 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212334630 (K2 campaign 6): PARAM radius (solar radii) 7.646443 (16th-84th percentiles 7.496322-7.882283), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8639 +/- 0.0539 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212334630 (K2 campaign 6): PARAM mass (solar masses) 0.863917 (16th-84th percentiles 0.823739-0.931579), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,628 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212334630: APOGEE DR17 effective temperature 4628.17 +/- 50 K (the catalogue's final uncertainty). log g 2.61 from the mass and radius.

**Colour.** A Planck spectrum at 4,628 K, because pARAM fits an extinction A_V = 0.32 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,628 K and log g 2.61 (u1 0.740, u2 0.063): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
