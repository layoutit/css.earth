# EPIC 210712441

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.21 solar masses and 10.6 solar radii; APOGEE spectra give 4,884 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 57435777313869952, distance 1,422 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210712441 (K2 campaign 4): PARAM asteroseismic distance (pc) 1422.421875 (16th-84th percentiles 1410.136719-1435.332031), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.671 ± 0.020 mas (32.9 standard errors), is not used. Radius 10.5793 +/- 0.1243 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210712441 (K2 campaign 4): PARAM radius (solar radii) 10.579339 (16th-84th percentiles 10.46202-10.710679), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2076 +/- 0.0531 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210712441 (K2 campaign 4): PARAM mass (solar masses) 1.207624 (16th-84th percentiles 1.154357-1.260489), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,884 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210712441: APOGEE DR17 effective temperature 4884.1274 +/- 50 K (the catalogue's final uncertainty). log g 2.47 from the mass and radius.

**Colour.** A Planck spectrum at 4,884 K, because pARAM fits an extinction A_V = 0.44 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,884 K and log g 2.47 (u1 0.658, u2 0.126): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
