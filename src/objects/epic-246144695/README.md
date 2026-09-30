# EPIC 246144695

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.89 solar masses and 13.1 solar radii; APOGEE spectra give 4,586 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2634924193707214080, distance 1,697 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246144695 (K2 campaign 12): PARAM asteroseismic distance (pc) 1696.660156 (16th-84th percentiles 1655.957031-1750.039062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.534 ± 0.015 mas (35.2 standard errors), is not used. Radius 13.073 +/- 0.5333 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246144695 (K2 campaign 12): PARAM radius (solar radii) 13.072995 (16th-84th percentiles 12.630375-13.696972), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8859 +/- 0.0841 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246144695 (K2 campaign 12): PARAM mass (solar masses) 0.885914 (16th-84th percentiles 0.818314-0.986518), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,586 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246144695: APOGEE DR17 effective temperature 4586.0117 +/- 50 K (the catalogue's final uncertainty). log g 2.15 from the mass and radius.

**Colour.** A Planck spectrum at 4,586 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,586 K and log g 2.15 (u1 0.746, u2 0.060): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
