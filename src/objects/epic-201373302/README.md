# EPIC 201373302

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.04 solar masses and 10.8 solar radii; APOGEE spectra give 4,972 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3697765841682439168, distance 5,225 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201373302 (K2 campaign 10): PARAM asteroseismic distance (pc) 5225.15625 (16th-84th percentiles 5080.78125-5383.28125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.176 ± 0.020 mas (8.8 standard errors), is not used. Radius 10.7742 +/- 0.4242 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201373302 (K2 campaign 10): PARAM radius (solar radii) 10.774161 (16th-84th percentiles 10.384314-11.232731), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0436 +/- 0.1012 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201373302 (K2 campaign 10): PARAM mass (solar masses) 1.043649 (16th-84th percentiles 0.95159-1.154004), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,972 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201373302: APOGEE DR17 effective temperature 4972.380999999999 +/- 50 K (the catalogue's final uncertainty). log g 2.39 from the mass and radius.

**Colour.** A Planck spectrum at 4,972 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,972 K and log g 2.39 (u1 0.631, u2 0.145): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
