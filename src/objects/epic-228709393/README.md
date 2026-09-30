# EPIC 228709393

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.85 solar masses and 8.5 solar radii; GALAH spectra give 4,700 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3578339839315246080, distance 2,739 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228709393 (K2 campaign 10): PARAM asteroseismic distance (pc) 2739.21875 (16th-84th percentiles 2675.234375-2820.859375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.318 ± 0.019 mas (16.9 standard errors), is not used. Radius 8.4866 +/- 0.2937 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228709393 (K2 campaign 10): PARAM radius (solar radii) 8.486644 (16th-84th percentiles 8.246095-8.833579), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8529 +/- 0.0703 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228709393 (K2 campaign 10): PARAM mass (solar masses) 0.85289 (16th-84th percentiles 0.797927-0.9385), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,700 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228709393: GALAH DR3 effective temperature 4699.766 +/- 109 K (the catalogue's final uncertainty). log g 2.51 from the mass and radius.

**Colour.** A Planck spectrum at 4,700 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,700 K and log g 2.51 (u1 0.715, u2 0.084): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
