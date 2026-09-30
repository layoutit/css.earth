# EPIC 247584868

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.24 solar masses and 20.6 solar radii; APOGEE spectra give 4,593 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3418390519866213504, distance 7,078 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247584868 (K2 campaign 13): PARAM asteroseismic distance (pc) 7078.359375 (16th-84th percentiles 6937.734375-7231.09375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.103 ± 0.030 mas (3.4 standard errors), is not used. Radius 20.6341 +/- 1.5774 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247584868 (K2 campaign 13): PARAM radius (solar radii) 20.634107 (16th-84th percentiles 18.285322-21.440119), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2438 +/- 0.1963 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247584868 (K2 campaign 13): PARAM mass (solar masses) 1.243804 (16th-84th percentiles 0.973826-1.366349), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,593 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247584868: APOGEE DR17 effective temperature 4592.7456 +/- 50 K (the catalogue's final uncertainty). log g 1.9 from the mass and radius.

**Colour.** A Planck spectrum at 4,593 K, because pARAM fits an extinction A_V = 1.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,593 K and log g 1.9 (u1 0.741, u2 0.065): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
