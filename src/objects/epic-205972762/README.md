# EPIC 205972762

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.87 solar masses and 11.6 solar radii; APOGEE spectra give 4,565 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2596130777779956480, distance 3,262 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205972762 (K2 campaign 3): PARAM asteroseismic distance (pc) 3262.226562 (16th-84th percentiles 3186.875-3357.96875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.251 ± 0.021 mas (12.0 standard errors), is not used. Radius 11.6153 +/- 0.4148 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205972762 (K2 campaign 3): PARAM radius (solar radii) 11.615256 (16th-84th percentiles 11.280652-12.11029), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8671 +/- 0.0717 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205972762 (K2 campaign 3): PARAM mass (solar masses) 0.867126 (16th-84th percentiles 0.811463-0.954928), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,565 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205972762: APOGEE DR17 effective temperature 4564.629 +/- 50 K (the catalogue's final uncertainty). log g 2.25 from the mass and radius.

**Colour.** A Planck spectrum at 4,565 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,565 K and log g 2.25 (u1 0.755, u2 0.053): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
