# EPIC 228986512

## Sources

Its oscillations, recorded in K2 campaign 10, give 2.59 solar masses and 39.2 solar radii; APOGEE spectra give 4,705 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3693987335614664576, distance 9,595 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228986512 (K2 campaign 10): PARAM asteroseismic distance (pc) 9594.84375 (16th-84th percentiles 9340.078125-9827.734375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.248 ± 0.016 mas (15.2 standard errors), is not used. Radius 39.1773 +/- 3.5131 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228986512 (K2 campaign 10): PARAM radius (solar radii) 39.177333 (16th-84th percentiles 34.153866-41.180082), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.5888 +/- 0.4477 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228986512 (K2 campaign 10): PARAM mass (solar masses) 2.588797 (16th-84th percentiles 1.938142-2.833559), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,705 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228986512: APOGEE DR17 effective temperature 4704.8047 +/- 50 K (the catalogue's final uncertainty). log g 1.67 from the mass and radius.

**Color.** A Planck spectrum at 4,705 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,705 K and log g 1.67 (u1 0.704, u2 0.091): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
