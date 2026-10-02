# EPIC 202602988

## Sources

Its oscillations, recorded in K2 campaign 2, give 1.13 solar masses and 10.6 solar radii; GALAH spectra give 4,626 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6038130114402617600, distance 1,571 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 202602988 (K2 campaign 2): PARAM asteroseismic distance (pc) 1570.878906 (16th-84th percentiles 1540.371094-1596.757812), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.597 ± 0.017 mas (35.4 standard errors), is not used. Radius 10.5884 +/- 0.4209 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 202602988 (K2 campaign 2): PARAM radius (solar radii) 10.588371 (16th-84th percentiles 9.995239-10.837082), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1313 +/- 0.1035 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 202602988 (K2 campaign 2): PARAM mass (solar masses) 1.131303 (16th-84th percentiles 0.998711-1.205778), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,626 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 202602988: GALAH DR3 effective temperature 4626.1577 +/- 85 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Color.** A Planck spectrum at 4,626 K, because pARAM fits an extinction A_V = 1.63 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,626 K and log g 2.44 (u1 0.738, u2 0.066): a model, because no fit of this star's limb is used.

## Surface storage

The uniform color surface is stored as one lossless texel with the same RGB value
as the full 2080×1536 atlas. Its decoded pixel storage falls from 12,779,520 bytes
to 4 bytes. Preparation retains the original atlas coordinate domain: the scene
geometry and complete runtime definition are unchanged. The pole coverage, limb
plate and arrival billboard remain byte-identical.

Matched native iPad evidence
records identical scene crops at Pixelmatch threshold 0.1. This saves decoded image
storage; the paired timing runs do not establish a reduction in remaining stalls.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
