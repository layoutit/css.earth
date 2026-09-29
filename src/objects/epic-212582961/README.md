# EPIC 212582961

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.97 solar masses and 9.9 solar radii; APOGEE spectra give 5,117 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3616745235013320576, distance 5,191 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212582961 (K2 campaign 6): PARAM asteroseismic distance (pc) 5190.703125 (16th-84th percentiles 5116.367188-5270.234375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.156 ± 0.021 mas (7.5 standard errors), is not used. Radius 9.885 +/- 0.1933 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212582961 (K2 campaign 6): PARAM radius (solar radii) 9.884976 (16th-84th percentiles 9.712468-10.099129), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9673 +/- 0.0527 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212582961 (K2 campaign 6): PARAM mass (solar masses) 0.967279 (16th-84th percentiles 0.924444-1.029912), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,117 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212582961: APOGEE DR17 effective temperature 5117.4033 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 5,117 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,117 K and log g 2.43 (u1 0.593, u2 0.172): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
