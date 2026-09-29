# EPIC 212175185

## Sources

Its oscillations, recorded in K2 campaign 16, give 1.15 solar masses and 9.8 solar radii; APOGEE spectra give 4,849 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 666229696255755648, distance 3,403 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212175185 (K2 campaign 16): PARAM asteroseismic distance (pc) 3403.085938 (16th-84th percentiles 3293.554688-3517.890625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.281 ± 0.017 mas (16.7 standard errors), is not used. Radius 9.7781 +/- 0.4171 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212175185 (K2 campaign 16): PARAM radius (solar radii) 9.77805 (16th-84th percentiles 9.373372-10.207642), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1454 +/- 0.1164 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212175185 (K2 campaign 16): PARAM mass (solar masses) 1.145375 (16th-84th percentiles 1.035668-1.26847), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,849 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212175185: APOGEE DR17 effective temperature 4848.6274 +/- 50 K (the catalogue's final uncertainty). log g 2.52 from the mass and radius.

**Colour.** A Planck spectrum at 4,849 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,849 K and log g 2.52 (u1 0.669, u2 0.118): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
