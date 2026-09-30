# EPIC 246427946

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.81 solar masses and 13.1 solar radii; APOGEE spectra give 4,529 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2645097493762675584, distance 3,123 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246427946 (K2 campaign 12): PARAM asteroseismic distance (pc) 3123.085938 (16th-84th percentiles 3072.65625-3183.515625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.344 ± 0.022 mas (15.4 standard errors), is not used. Radius 13.0612 +/- 0.3406 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246427946 (K2 campaign 12): PARAM radius (solar radii) 13.061216 (16th-84th percentiles 12.792672-13.473864), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.815 +/- 0.0458 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246427946 (K2 campaign 12): PARAM mass (solar masses) 0.814986 (16th-84th percentiles 0.783727-0.875396), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,529 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246427946: APOGEE DR17 effective temperature 4529.223 +/- 50 K (the catalogue's final uncertainty). log g 2.12 from the mass and radius.

**Colour.** A Planck spectrum at 4,529 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,529 K and log g 2.12 (u1 0.764, u2 0.047): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
