# EPIC 242189351

## Sources

Its oscillations, recorded in K2 campaign 11, give 1.23 solar masses and 10.1 solar radii; APOGEE spectra give 4,472 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4056940311536371456, distance 1,540 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 242189351 (K2 campaign 11): PARAM asteroseismic distance (pc) 1540.332031 (16th-84th percentiles 1485.078125-1599.628906), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.582 ± 0.044 mas (13.3 standard errors), is not used. Radius 10.0822 +/- 0.4769 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 242189351 (K2 campaign 11): PARAM radius (solar radii) 10.082161 (16th-84th percentiles 9.649255-10.603143), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2332 +/- 0.1395 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 242189351 (K2 campaign 11): PARAM mass (solar masses) 1.233191 (16th-84th percentiles 1.113721-1.392699), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,472 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 242189351: APOGEE DR17 effective temperature 4472.4404 +/- 50 K (the catalogue's final uncertainty). log g 2.52 from the mass and radius.

**Colour.** A Planck spectrum at 4,472 K, because pARAM fits an extinction A_V = 4.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,472 K and log g 2.52 (u1 0.789, u2 0.025): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
