# EPIC 213690825

## Sources

Its oscillations, recorded in K2 campaign 7, give 0.92 solar masses and 14.4 solar radii; APOGEE spectra give 4,714 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6759683692416334336, distance 5,721 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213690825 (K2 campaign 7): PARAM asteroseismic distance (pc) 5720.625 (16th-84th percentiles 5458.4375-6011.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.105 ± 0.021 mas (4.9 standard errors), is not used. Radius 14.3549 +/- 0.8204 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213690825 (K2 campaign 7): PARAM radius (solar radii) 14.354877 (16th-84th percentiles 13.611205-15.252043), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9214 +/- 0.1203 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213690825 (K2 campaign 7): PARAM mass (solar masses) 0.921449 (16th-84th percentiles 0.815946-1.056572), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,714 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 213690825: APOGEE DR17 effective temperature 4714.1255 +/- 50 K (the catalogue's final uncertainty). log g 2.09 from the mass and radius.

**Colour.** A Planck spectrum at 4,714 K, because pARAM fits an extinction A_V = 0.36 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,714 K and log g 2.09 (u1 0.705, u2 0.092): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
