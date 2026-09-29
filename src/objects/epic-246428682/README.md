# EPIC 246428682

## Sources

Its oscillations, recorded in K2 campaign 12, give 1.82 solar masses and 14.5 solar radii; APOGEE spectra give 4,741 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2645108905491454336, distance 3,679 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246428682 (K2 campaign 12): PARAM asteroseismic distance (pc) 3679.414062 (16th-84th percentiles 3601.289062-3757.539062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.408 ± 0.028 mas (14.4 standard errors), is not used. Radius 14.5458 +/- 0.561 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246428682 (K2 campaign 12): PARAM radius (solar radii) 14.545792 (16th-84th percentiles 13.951676-15.073731), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.819 +/- 0.139 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246428682 (K2 campaign 12): PARAM mass (solar masses) 1.819042 (16th-84th percentiles 1.664211-1.94225), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,741 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246428682: APOGEE DR17 effective temperature 4741.3345 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,741 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,741 K and log g 2.37 (u1 0.700, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
