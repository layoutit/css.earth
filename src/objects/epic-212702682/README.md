# EPIC 212702682

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.85 solar masses and 9.3 solar radii; APOGEE spectra give 5,025 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3616253993833733888, distance 3,886 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212702682 (K2 campaign 6): PARAM asteroseismic distance (pc) 3886.367188 (16th-84th percentiles 3757.109375-4021.015625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.223 ± 0.015 mas (15.2 standard errors), is not used. Radius 9.3405 +/- 0.4163 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212702682 (K2 campaign 6): PARAM radius (solar radii) 9.340488 (16th-84th percentiles 8.946958-9.77958), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8516 +/- 0.0915 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212702682 (K2 campaign 6): PARAM mass (solar masses) 0.851641 (16th-84th percentiles 0.767539-0.950583), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,025 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212702682: APOGEE DR17 effective temperature 5024.854 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 5,025 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,025 K and log g 2.43 (u1 0.617, u2 0.156): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
