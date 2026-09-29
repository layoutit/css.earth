# EPIC 220281055

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.91 solar masses and 8.3 solar radii; APOGEE spectra give 5,051 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2549913257478182784, distance 3,159 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220281055 (K2 campaign 8): PARAM asteroseismic distance (pc) 3158.867188 (16th-84th percentiles 3058.046875-3265.351562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.297 ± 0.018 mas (16.5 standard errors), is not used. Radius 8.3365 +/- 0.3593 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220281055 (K2 campaign 8): PARAM radius (solar radii) 8.336529 (16th-84th percentiles 7.992135-8.710817), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9137 +/- 0.0947 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220281055 (K2 campaign 8): PARAM mass (solar masses) 0.913693 (16th-84th percentiles 0.825778-1.015148), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,051 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220281055: APOGEE DR17 effective temperature 5051.2954 +/- 50 K (the catalogue's final uncertainty). log g 2.56 from the mass and radius.

**Colour.** A Planck spectrum at 5,051 K, because pARAM fits an extinction A_V = 0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,051 K and log g 2.56 (u1 0.611, u2 0.160): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
