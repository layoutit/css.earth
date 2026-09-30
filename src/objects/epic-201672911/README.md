# EPIC 201672911

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.06 solar masses and 9.0 solar radii; APOGEE spectra give 4,765 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3892900018554851328, distance 1,539 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201672911 (K2 campaign 1): PARAM asteroseismic distance (pc) 1539.316406 (16th-84th percentiles 1487.636719-1592.167969), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.725 ± 0.020 mas (35.9 standard errors), is not used. Radius 8.9741 +/- 0.3774 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201672911 (K2 campaign 1): PARAM radius (solar radii) 8.974128 (16th-84th percentiles 8.600849-9.355609), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0588 +/- 0.1162 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201672911 (K2 campaign 1): PARAM mass (solar masses) 1.058827 (16th-84th percentiles 0.94749-1.179826), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,765 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201672911: APOGEE DR17 effective temperature 4764.999 +/- 50 K (the catalogue's final uncertainty). log g 2.56 from the mass and radius.

**Colour.** A Planck spectrum at 4,765 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,765 K and log g 2.56 (u1 0.695, u2 0.099): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
