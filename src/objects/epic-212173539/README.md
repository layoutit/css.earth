# EPIC 212173539

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.06 solar masses and 25.8 solar radii; APOGEE spectra give 4,347 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 690184721730621184, distance 4,695 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212173539 (K2 campaign 5): PARAM asteroseismic distance (pc) 4695.234375 (16th-84th percentiles 4365.546875-5068.164062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.197 ± 0.019 mas (10.2 standard errors), is not used. Radius 25.8165 +/- 2.419 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212173539 (K2 campaign 5): PARAM radius (solar radii) 25.816496 (16th-84th percentiles 23.687045-28.524949), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0593 +/- 0.2118 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212173539 (K2 campaign 5): PARAM mass (solar masses) 1.059281 (16th-84th percentiles 0.882723-1.306315), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,347 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212173539: APOGEE DR17 effective temperature 4346.536 +/- 50 K (the catalogue's final uncertainty). log g 1.64 from the mass and radius.

**Colour.** A Planck spectrum at 4,347 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,347 K and log g 1.64 (u1 0.819, u2 0.002): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
