# EPIC 210442867

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.97 solar masses and 16.0 solar radii; APOGEE spectra give 4,463 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3311492215544512512, distance 2,127 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210442867 (K2 campaign 4): PARAM asteroseismic distance (pc) 2126.992188 (16th-84th percentiles 2033.496094-2234.589844), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.486 ± 0.015 mas (32.4 standard errors), is not used. Radius 16.0107 +/- 0.9618 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210442867 (K2 campaign 4): PARAM radius (solar radii) 16.010704 (16th-84th percentiles 15.152342-17.076031), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9673 +/- 0.1306 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210442867 (K2 campaign 4): PARAM mass (solar masses) 0.967297 (16th-84th percentiles 0.855317-1.116593), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,463 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210442867: APOGEE DR17 effective temperature 4463.4243 +/- 50 K (the catalogue's final uncertainty). log g 2.01 from the mass and radius.

**Colour.** A Planck spectrum at 4,463 K, because pARAM fits an extinction A_V = 1.24 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,463 K and log g 2.01 (u1 0.783, u2 0.032): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
