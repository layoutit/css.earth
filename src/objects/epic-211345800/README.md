# EPIC 211345800

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.26 solar masses and 10.6 solar radii; APOGEE spectra give 5,005 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 600103761290108288, distance 1,585 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211345800 (K2 campaign 5): PARAM asteroseismic distance (pc) 1584.492188 (16th-84th percentiles 1563.828125-1605.429688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.581 ± 0.020 mas (28.5 standard errors), is not used. Radius 10.5708 +/- 0.1283 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211345800 (K2 campaign 5): PARAM radius (solar radii) 10.57079 (16th-84th percentiles 10.451182-10.70788), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2586 +/- 0.0557 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211345800 (K2 campaign 5): PARAM mass (solar masses) 1.258581 (16th-84th percentiles 1.203591-1.315046), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,005 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211345800: APOGEE DR17 effective temperature 5005.443 +/- 50 K (the catalogue's final uncertainty). log g 2.49 from the mass and radius.

**Colour.** A Planck spectrum at 5,005 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,005 K and log g 2.49 (u1 0.623, u2 0.152): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
