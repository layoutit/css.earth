# EPIC 206017159

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.86 solar masses and 7.8 solar radii; APOGEE spectra give 4,658 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6839484146113319040, distance 1,262 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206017159 (K2 campaign 3): PARAM asteroseismic distance (pc) 1262.001953 (16th-84th percentiles 1240.488281-1289.628906), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.726 ± 0.019 mas (37.8 standard errors), is not used. Radius 7.8265 +/- 0.2026 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206017159 (K2 campaign 3): PARAM radius (solar radii) 7.826496 (16th-84th percentiles 7.665639-8.070762), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8581 +/- 0.0543 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206017159 (K2 campaign 3): PARAM mass (solar masses) 0.858076 (16th-84th percentiles 0.817775-0.926466), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,658 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206017159: APOGEE DR17 effective temperature 4657.5273 +/- 50 K (the catalogue's final uncertainty). log g 2.58 from the mass and radius.

**Colour.** A Planck spectrum at 4,658 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,658 K and log g 2.58 (u1 0.730, u2 0.072): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
