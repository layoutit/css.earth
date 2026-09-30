# EPIC 211956503

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.96 solar masses and 11.1 solar radii; APOGEE spectra give 4,940 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 661247976571685888, distance 3,634 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211956503 (K2 campaign 16): PARAM asteroseismic distance (pc) 3633.515625 (16th-84th percentiles 3568.984375-3706.445312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.233 ± 0.015 mas (15.5 standard errors), is not used. Radius 11.1326 +/- 0.3627 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211956503 (K2 campaign 16): PARAM radius (solar radii) 11.13258 (16th-84th percentiles 10.797034-11.522404), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9633 +/- 0.0783 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211956503 (K2 campaign 16): PARAM mass (solar masses) 0.963271 (16th-84th percentiles 0.89475-1.051422), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,940 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211956503: APOGEE DR17 effective temperature 4939.5790000000015 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Colour.** A Planck spectrum at 4,940 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,940 K and log g 2.33 (u1 0.640, u2 0.139): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
