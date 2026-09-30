# EPIC 246095861

## Sources

Its oscillations, recorded in K2 campaign 12, give 1.13 solar masses and 11.4 solar radii; APOGEE spectra give 5,060 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2610621142738462208, distance 3,341 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246095861 (K2 campaign 12): PARAM asteroseismic distance (pc) 3340.507812 (16th-84th percentiles 3241.210938-3466.640625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.426 ± 0.017 mas (24.5 standard errors), is not used. Radius 11.3825 +/- 0.5143 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246095861 (K2 campaign 12): PARAM radius (solar radii) 11.382523 (16th-84th percentiles 10.890355-11.918869), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.134 +/- 0.1237 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246095861 (K2 campaign 12): PARAM mass (solar masses) 1.134025 (16th-84th percentiles 1.015715-1.263142), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,060 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246095861: APOGEE DR17 effective temperature 5059.593 +/- 50 K (the catalogue's final uncertainty). log g 2.38 from the mass and radius.

**Colour.** A Planck spectrum at 5,060 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,060 K and log g 2.38 (u1 0.607, u2 0.162): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
