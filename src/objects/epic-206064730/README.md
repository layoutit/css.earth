# EPIC 206064730

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.82 solar masses and 10.3 solar radii; APOGEE spectra give 4,573 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6840669419648213376, distance 2,021 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206064730 (K2 campaign 3): PARAM asteroseismic distance (pc) 2020.976562 (16th-84th percentiles 1995.839844-2049.316406), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.462 ± 0.013 mas (35.7 standard errors), is not used. Radius 10.2837 +/- 0.1753 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206064730 (K2 campaign 3): PARAM radius (solar radii) 10.283693 (16th-84th percentiles 10.134426-10.485001), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8182 +/- 0.0281 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206064730 (K2 campaign 3): PARAM mass (solar masses) 0.818201 (16th-84th percentiles 0.799108-0.85527), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,573 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206064730: APOGEE DR17 effective temperature 4573.011 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Color.** A Planck spectrum at 4,573 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,573 K and log g 2.33 (u1 0.753, u2 0.054): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
