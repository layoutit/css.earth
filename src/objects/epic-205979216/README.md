# EPIC 205979216

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.95 solar masses and 6.9 solar radii; GALAH spectra give 4,976 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6827140169586951808, distance 2,825 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205979216 (K2 campaign 3): PARAM asteroseismic distance (pc) 2824.726562 (16th-84th percentiles 2717.695312-2937.265625), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.322 ± 0.018 mas (17.9 standard errors), is not used. Radius 6.8659 +/- 0.3106 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205979216 (K2 campaign 3): PARAM radius (solar radii) 6.865937 (16th-84th percentiles 6.570477-7.191675), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9482 +/- 0.1029 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205979216 (K2 campaign 3): PARAM mass (solar masses) 0.948206 (16th-84th percentiles 0.853078-1.058909), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,976 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 205979216: GALAH DR3 effective temperature 4975.6245 +/- 189 K (the catalogue's final uncertainty). log g 2.74 from the mass and radius.

**Colour.** A Planck spectrum at 4,976 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,976 K and log g 2.74 (u1 0.635, u2 0.143): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
