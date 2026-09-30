# EPIC 229012557

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.84 solar masses and 10.1 solar radii; APOGEE spectra give 4,979 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3694823823444941568, distance 5,779 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229012557 (K2 campaign 10): PARAM asteroseismic distance (pc) 5779.0625 (16th-84th percentiles 5677.1875-5893.359375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.210 ± 0.023 mas (9.1 standard errors), is not used. Radius 10.0752 +/- 0.2583 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229012557 (K2 campaign 10): PARAM radius (solar radii) 10.075187 (16th-84th percentiles 9.851576-10.368225), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8438 +/- 0.0508 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229012557 (K2 campaign 10): PARAM mass (solar masses) 0.843836 (16th-84th percentiles 0.797726-0.899361), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,979 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229012557: APOGEE DR17 effective temperature 4978.795999999999 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,979 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,979 K and log g 2.36 (u1 0.629, u2 0.147): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
