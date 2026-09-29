# EPIC 206055949

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.90 solar masses and 7.1 solar radii; APOGEE spectra give 4,683 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6840603281447328640, distance 1,914 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206055949 (K2 campaign 3): PARAM asteroseismic distance (pc) 1913.828125 (16th-84th percentiles 1869.121094-1964.824219), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.376 ± 0.022 mas (17.0 standard errors), is not used. Radius 7.1408 +/- 0.2112 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206055949 (K2 campaign 3): PARAM radius (solar radii) 7.140796 (16th-84th percentiles 6.955206-7.377695), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8952 +/- 0.065 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206055949 (K2 campaign 3): PARAM mass (solar masses) 0.895218 (16th-84th percentiles 0.838497-0.968442), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,683 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206055949: APOGEE DR17 effective temperature 4682.888 +/- 50 K (the catalogue's final uncertainty). log g 2.68 from the mass and radius.

**Colour.** A Planck spectrum at 4,683 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,683 K and log g 2.68 (u1 0.723, u2 0.076): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
