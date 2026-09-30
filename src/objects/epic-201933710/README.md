# EPIC 201933710

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.80 solar masses and 7.7 solar radii; APOGEE spectra give 4,973 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3910797765752199168, distance 3,827 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201933710 (K2 campaign 1): PARAM asteroseismic distance (pc) 3826.5625 (16th-84th percentiles 3726.992188-3941.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.246 ± 0.019 mas (12.9 standard errors), is not used. Radius 7.6901 +/- 0.2604 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201933710 (K2 campaign 1): PARAM radius (solar radii) 7.690116 (16th-84th percentiles 7.463418-7.984315), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8 +/- 0.0727 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201933710 (K2 campaign 1): PARAM mass (solar masses) 0.79999 (16th-84th percentiles 0.738072-0.883432), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,973 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201933710: APOGEE DR17 effective temperature 4973.3315 +/- 50 K (the catalogue's final uncertainty). log g 2.57 from the mass and radius.

**Colour.** A Planck spectrum at 4,973 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,973 K and log g 2.57 (u1 0.633, u2 0.144): a model, because no fit of this star's limb is used.

## Surface storage

The uniform color surface is stored as one lossless texel with the same RGB value
as the full 2080×1536 atlas. Its decoded pixel storage falls from 12,779,520 bytes
to 4 bytes. Preparation retains the original atlas coordinate domain: the scene
geometry and complete runtime definition are unchanged. The pole coverage, limb
plate and arrival billboard remain byte-identical.

[Matched native iPad evidence](../../../packages/bake/evidence/constant-surface-raster.json)
records identical scene crops at Pixelmatch threshold 0.1. This saves decoded image
storage; the paired timing runs do not establish a reduction in remaining stalls.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
