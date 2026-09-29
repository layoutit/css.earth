# EPIC 201695058

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.94 solar masses and 11.8 solar radii; APOGEE spectra give 4,747 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3800811418602655232, distance 3,700 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201695058 (K2 campaign 1): PARAM asteroseismic distance (pc) 3699.804688 (16th-84th percentiles 3544.21875-3831.757812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.213 ± 0.019 mas (11.0 standard errors), is not used. Radius 11.7727 +/- 0.608 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201695058 (K2 campaign 1): PARAM radius (solar radii) 11.772653 (16th-84th percentiles 11.13961-12.35556), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9429 +/- 0.1214 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201695058 (K2 campaign 1): PARAM mass (solar masses) 0.942858 (16th-84th percentiles 0.814493-1.057373), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,747 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201695058: APOGEE DR17 effective temperature 4746.9756 +/- 50 K (the catalogue's final uncertainty). log g 2.27 from the mass and radius.

**Colour.** A Planck spectrum at 4,747 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,747 K and log g 2.27 (u1 0.697, u2 0.098): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
