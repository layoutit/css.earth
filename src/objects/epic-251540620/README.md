# EPIC 251540620

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.99 solar masses and 16.3 solar radii; APOGEE spectra give 4,714 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3638099842473215744, distance 4,938 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251540620 (K2 campaign 17): PARAM asteroseismic distance (pc) 4937.890625 (16th-84th percentiles 4681.132812-5208.125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.150 ± 0.015 mas (9.8 standard errors), is not used. Radius 16.3398 +/- 1.1522 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251540620 (K2 campaign 17): PARAM radius (solar radii) 16.339826 (16th-84th percentiles 15.264767-17.569072), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9874 +/- 0.1555 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251540620 (K2 campaign 17): PARAM mass (solar masses) 0.98738 (16th-84th percentiles 0.848084-1.159035), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,714 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251540620: APOGEE DR17 effective temperature 4713.5884 +/- 50 K (the catalogue's final uncertainty). log g 2.01 from the mass and radius.

**Colour.** A Planck spectrum at 4,714 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,714 K and log g 2.01 (u1 0.704, u2 0.093): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
