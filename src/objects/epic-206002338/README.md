# EPIC 206002338

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.96 solar masses and 11.8 solar radii; APOGEE spectra give 4,624 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2600010851234729472, distance 2,276 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206002338 (K2 campaign 3): PARAM asteroseismic distance (pc) 2276.289062 (16th-84th percentiles 2189.140625-2368.945312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.380 ± 0.012 mas (32.2 standard errors), is not used. Radius 11.7638 +/- 0.5766 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206002338 (K2 campaign 3): PARAM radius (solar radii) 11.763821 (16th-84th percentiles 11.227947-12.381182), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9634 +/- 0.1103 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206002338 (K2 campaign 3): PARAM mass (solar masses) 0.963361 (16th-84th percentiles 0.864434-1.084973), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,624 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206002338: APOGEE DR17 effective temperature 4623.5605 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Colour.** A Planck spectrum at 4,624 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,624 K and log g 2.28 (u1 0.736, u2 0.067): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
