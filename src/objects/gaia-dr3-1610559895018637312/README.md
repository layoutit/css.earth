# Gaia DR3 1610559895018637312

## Sources

Gaia's parallax, brightness and spectrum give it 22.3 solar radii and 4.29 solar masses (FLAME) and 5,764 K at its surface (GSP-Phot). This account was drafted from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1610559895018637312, parallax 0.088 ± 0.011 mas (11416.31 pc). Radius 22.329 (21.031 to 24.553) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 4.287 (4.247 to 4.490) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 5,764 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 1610559895018637312: teff_gspphot 5763.7764 K (16th-84th percentiles 5759.3735-5768.528), the temperature FLAME used. log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 5,764 K, because gSP-Phot fits an extinction A_G = 0.73 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the colour routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #fff1e9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,764 K and log g 2.37 (u1 0.447, u2 0.261): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
