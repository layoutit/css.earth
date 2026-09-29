# EPIC 205643699

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.95 solar masses and 8.3 solar radii; GALAH spectra give 4,847 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4325127247845984384, distance 1,031 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205643699 (K2 campaign 2): PARAM asteroseismic distance (pc) 1030.9375 (16th-84th percentiles 997.8125-1069.980469), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 1.106 ± 0.034 mas (32.2 standard errors), is not used. Radius 8.2647 +/- 0.3502 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205643699 (K2 campaign 2): PARAM radius (solar radii) 8.264685 (16th-84th percentiles 7.951246-8.651666), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9477 +/- 0.0985 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205643699 (K2 campaign 2): PARAM mass (solar masses) 0.947696 (16th-84th percentiles 0.86377-1.06076), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,847 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205643699: GALAH DR3 effective temperature 4846.5103 +/- 125 K (the catalogue's final uncertainty). log g 2.58 from the mass and radius.

**Colour.** A Planck spectrum at 4,847 K, because pARAM fits an extinction A_V = 1.00 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,847 K and log g 2.58 (u1 0.671, u2 0.117): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
