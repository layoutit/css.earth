# EPIC 201757091

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.85 solar masses and 10.9 solar radii; APOGEE spectra give 4,681 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3896349289610688000, distance 2,436 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201757091 (K2 campaign 1): PARAM asteroseismic distance (pc) 2436.386719 (16th-84th percentiles 2377.929688-2510.175781), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.446 ± 0.024 mas (18.5 standard errors), is not used. Radius 10.9338 +/- 0.3678 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201757091 (K2 campaign 1): PARAM radius (solar radii) 10.933795 (16th-84th percentiles 10.635714-11.371306), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8494 +/- 0.0728 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201757091 (K2 campaign 1): PARAM mass (solar masses) 0.849425 (16th-84th percentiles 0.792789-0.938296), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,681 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201757091: APOGEE DR17 effective temperature 4680.792 +/- 50 K (the catalogue's final uncertainty). log g 2.29 from the mass and radius.

**Colour.** A Planck spectrum at 4,681 K, because pARAM fits an extinction A_V = 0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,681 K and log g 2.29 (u1 0.718, u2 0.081): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
