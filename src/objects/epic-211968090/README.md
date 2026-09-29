# EPIC 211968090

## Sources

Its oscillations, recorded in K2 campaign 16, give 1.41 solar masses and 11.7 solar radii; APOGEE spectra give 4,884 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 661169537585408896, distance 6,640 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211968090 (K2 campaign 16): PARAM asteroseismic distance (pc) 6640.3125 (16th-84th percentiles 6415.859375-6887.265625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.087 ± 0.023 mas (3.8 standard errors), is not used. Radius 11.675 +/- 0.5723 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211968090 (K2 campaign 16): PARAM radius (solar radii) 11.675007 (16th-84th percentiles 11.154716-12.299285), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4128 +/- 0.1622 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211968090 (K2 campaign 16): PARAM mass (solar masses) 1.412828 (16th-84th percentiles 1.269954-1.594353), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,884 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211968090: APOGEE DR17 effective temperature 4884.317 +/- 50 K (the catalogue's final uncertainty). log g 2.45 from the mass and radius.

**Colour.** A Planck spectrum at 4,884 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,884 K and log g 2.45 (u1 0.658, u2 0.126): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
