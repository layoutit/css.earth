# EPIC 220634831

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.95 solar masses and 14.6 solar radii; APOGEE spectra give 4,804 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2579831621704871040, distance 4,618 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634831 (K2 campaign 8): PARAM asteroseismic distance (pc) 4618.125 (16th-84th percentiles 4409.921875-4842.460938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.189 ± 0.018 mas (10.4 standard errors), is not used. Radius 14.5991 +/- 0.9476 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634831 (K2 campaign 8): PARAM radius (solar radii) 14.599128 (16th-84th percentiles 13.729622-15.62484), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9523 +/- 0.1431 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634831 (K2 campaign 8): PARAM mass (solar masses) 0.95234 (16th-84th percentiles 0.827038-1.113142), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,804 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220634831: APOGEE DR17 effective temperature 4803.5737 +/- 50 K (the catalogue's final uncertainty). log g 2.09 from the mass and radius.

**Colour.** A Planck spectrum at 4,804 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,804 K and log g 2.09 (u1 0.678, u2 0.112): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
