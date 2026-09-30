# EPIC 213727734

## Sources

Its oscillations, recorded in K2 campaign 7, give 1.65 solar masses and 21.1 solar radii; GALAH spectra give 4,586 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6765538248233352576, distance 7,028 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213727734 (K2 campaign 7): PARAM asteroseismic distance (pc) 7028.046875 (16th-84th percentiles 6630.703125-7342.734375), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.127 ± 0.023 mas (5.4 standard errors), is not used. Radius 21.1242 +/- 1.5926 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213727734 (K2 campaign 7): PARAM radius (solar radii) 21.124151 (16th-84th percentiles 19.493162-22.678455), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.6487 +/- 0.2703 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213727734 (K2 campaign 7): PARAM mass (solar masses) 1.64875 (16th-84th percentiles 1.377905-1.918552), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,586 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 213727734: GALAH DR3 effective temperature 4585.556 +/- 148 K (the catalogue's final uncertainty). log g 2.01 from the mass and radius.

**Colour.** A Planck spectrum at 4,586 K, because pARAM fits an extinction A_V = 0.34 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,586 K and log g 2.01 (u1 0.744, u2 0.062): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
