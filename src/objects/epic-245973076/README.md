# EPIC 245973076

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.84 solar masses and 11.3 solar radii; APOGEE spectra give 4,572 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2437620822128210688, distance 3,571 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245973076 (K2 campaign 12): PARAM asteroseismic distance (pc) 3571.328125 (16th-84th percentiles 3498.789062-3665.820312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.277 ± 0.019 mas (14.9 standard errors), is not used. Radius 11.2659 +/- 0.352 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245973076 (K2 campaign 12): PARAM radius (solar radii) 11.265857 (16th-84th percentiles 10.991003-11.695047), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8411 +/- 0.0588 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245973076 (K2 campaign 12): PARAM mass (solar masses) 0.841101 (16th-84th percentiles 0.798238-0.915783), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,572 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245973076: APOGEE DR17 effective temperature 4571.587 +/- 50 K (the catalogue's final uncertainty). log g 2.26 from the mass and radius.

**Colour.** A Planck spectrum at 4,572 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,572 K and log g 2.26 (u1 0.752, u2 0.055): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
