# EPIC 220673568

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.75 solar masses and 12.5 solar radii; APOGEE spectra give 4,859 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2580139244442400256, distance 6,077 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220673568 (K2 campaign 8): PARAM asteroseismic distance (pc) 6077.34375 (16th-84th percentiles 5976.171875-6199.921875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.125 ± 0.027 mas (4.6 standard errors), is not used. Radius 12.5016 +/- 0.3987 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220673568 (K2 campaign 8): PARAM radius (solar radii) 12.50163 (16th-84th percentiles 12.200838-12.998301), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7484 +/- 0.0534 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220673568 (K2 campaign 8): PARAM mass (solar masses) 0.748398 (16th-84th percentiles 0.712465-0.819328), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,859 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220673568: APOGEE DR17 effective temperature 4858.7856 +/- 50 K (the catalogue's final uncertainty). log g 2.12 from the mass and radius.

**Colour.** A Planck spectrum at 4,859 K, because pARAM fits an extinction A_V = 0.25 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,859 K and log g 2.12 (u1 0.662, u2 0.123): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
