# EPIC 229113572

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.88 solar masses and 11.9 solar radii; APOGEE spectra give 4,886 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3697216532546130816, distance 7,255 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229113572 (K2 campaign 10): PARAM asteroseismic distance (pc) 7254.765625 (16th-84th percentiles 6942.65625-7559.140625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.167 ± 0.028 mas (6.0 standard errors), is not used. Radius 11.8673 +/- 0.6531 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229113572 (K2 campaign 10): PARAM radius (solar radii) 11.867306 (16th-84th percentiles 11.234008-12.540291), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8819 +/- 0.1144 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229113572 (K2 campaign 10): PARAM mass (solar masses) 0.881894 (16th-84th percentiles 0.773567-1.002422), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,886 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229113572: APOGEE DR17 effective temperature 4886.49 +/- 50 K (the catalogue's final uncertainty). log g 2.23 from the mass and radius.

**Color.** A Planck spectrum at 4,886 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,886 K and log g 2.23 (u1 0.655, u2 0.128): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
