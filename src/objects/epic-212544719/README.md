# EPIC 212544719

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.84 solar masses and 16.2 solar radii; APOGEE spectra give 4,559 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3613444569826286848, distance 7,130 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212544719 (K2 campaign 6): PARAM asteroseismic distance (pc) 7130.234375 (16th-84th percentiles 6971.40625-7339.765625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.085 ± 0.023 mas (3.7 standard errors), is not used. Radius 16.2079 +/- 0.6469 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212544719 (K2 campaign 6): PARAM radius (solar radii) 16.207947 (16th-84th percentiles 15.707244-17.001066), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8401 +/- 0.0737 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212544719 (K2 campaign 6): PARAM mass (solar masses) 0.8401 (16th-84th percentiles 0.786984-0.934393), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,559 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212544719: APOGEE DR17 effective temperature 4558.9834 +/- 50 K (the catalogue's final uncertainty). log g 1.94 from the mass and radius.

**Colour.** A Planck spectrum at 4,559 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,559 K and log g 1.94 (u1 0.752, u2 0.057): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
