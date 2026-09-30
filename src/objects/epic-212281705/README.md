# EPIC 212281705

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.96 solar masses and 10.6 solar radii; APOGEE spectra give 4,914 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6294908204519127424, distance 2,930 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212281705 (K2 campaign 6): PARAM asteroseismic distance (pc) 2929.960938 (16th-84th percentiles 2839.960938-3085.507812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.312 ± 0.016 mas (19.7 standard errors), is not used. Radius 10.6464 +/- 0.6397 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212281705 (K2 campaign 6): PARAM radius (solar radii) 10.646434 (16th-84th percentiles 10.060645-11.340048), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9582 +/- 0.1235 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212281705 (K2 campaign 6): PARAM mass (solar masses) 0.958189 (16th-84th percentiles 0.85222-1.099211), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,914 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212281705: APOGEE DR17 effective temperature 4913.768 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,914 K, because pARAM fits an extinction A_V = 0.29 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,914 K and log g 2.37 (u1 0.648, u2 0.133): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
