# EPIC 201395169

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.05 solar masses and 13.7 solar radii; APOGEE spectra give 4,628 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3791893829545452928, distance 3,566 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201395169 (K2 campaign 1): PARAM asteroseismic distance (pc) 3565.898438 (16th-84th percentiles 3438.59375-3695.273438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.284 ± 0.016 mas (17.6 standard errors), is not used. Radius 13.6682 +/- 0.6317 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201395169 (K2 campaign 1): PARAM radius (solar radii) 13.668226 (16th-84th percentiles 13.047549-14.310873), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0527 +/- 0.13 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201395169 (K2 campaign 1): PARAM mass (solar masses) 1.052735 (16th-84th percentiles 0.929849-1.189799), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,628 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201395169: APOGEE DR17 effective temperature 4628.1606 +/- 50 K (the catalogue's final uncertainty). log g 2.19 from the mass and radius.

**Colour.** A Planck spectrum at 4,628 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,628 K and log g 2.19 (u1 0.734, u2 0.070): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
