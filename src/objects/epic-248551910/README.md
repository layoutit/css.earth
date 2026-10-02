# EPIC 248551910

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.88 solar masses and 10.3 solar radii; APOGEE spectra give 5,031 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3858616932467115008, distance 3,145 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248551910 (K2 campaign 14): PARAM asteroseismic distance (pc) 3144.882812 (16th-84th percentiles 3083.359375-3208.085938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.328 ± 0.017 mas (19.4 standard errors), is not used. Radius 10.3058 +/- 0.3235 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248551910 (K2 campaign 14): PARAM radius (solar radii) 10.305757 (16th-84th percentiles 10.003618-10.650713), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8849 +/- 0.0628 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248551910 (K2 campaign 14): PARAM mass (solar masses) 0.884905 (16th-84th percentiles 0.817263-0.942955), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,031 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248551910: APOGEE DR17 effective temperature 5031.2627 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Color.** A Planck spectrum at 5,031 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,031 K and log g 2.36 (u1 0.615, u2 0.157): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
