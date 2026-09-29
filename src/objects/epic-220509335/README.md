# EPIC 220509335

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.88 solar masses and 9.7 solar radii; APOGEE spectra give 5,002 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2577494300502623360, distance 3,590 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220509335 (K2 campaign 8): PARAM asteroseismic distance (pc) 3590.351562 (16th-84th percentiles 3507.304688-3669.570312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.225 ± 0.019 mas (11.8 standard errors), is not used. Radius 9.67 +/- 0.3133 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220509335 (K2 campaign 8): PARAM radius (solar radii) 9.670008 (16th-84th percentiles 9.36407-9.990688), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.882 +/- 0.0742 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220509335 (K2 campaign 8): PARAM mass (solar masses) 0.882018 (16th-84th percentiles 0.800289-0.948692), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,002 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220509335: APOGEE DR17 effective temperature 5001.8613 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Colour.** A Planck spectrum at 5,002 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,002 K and log g 2.41 (u1 0.623, u2 0.152): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
