# EPIC 220515000

## Sources

Its oscillations, recorded in K2 campaign 8, give 1.09 solar masses and 8.4 solar radii; APOGEE spectra give 4,542 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2565733340015990784, distance 1,948 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220515000 (K2 campaign 8): PARAM asteroseismic distance (pc) 1947.792969 (16th-84th percentiles 1909.472656-1986.914062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.565 ± 0.019 mas (29.2 standard errors), is not used. Radius 8.3536 +/- 0.225 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220515000 (K2 campaign 8): PARAM radius (solar radii) 8.353638 (16th-84th percentiles 8.127974-8.577963), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0855 +/- 0.0644 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220515000 (K2 campaign 8): PARAM mass (solar masses) 1.085528 (16th-84th percentiles 1.021614-1.150448), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,542 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220515000: APOGEE DR17 effective temperature 4542.4214 +/- 50 K (the catalogue's final uncertainty). log g 2.63 from the mass and radius.

**Colour.** A Planck spectrum at 4,542 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,542 K and log g 2.63 (u1 0.768, u2 0.041): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
