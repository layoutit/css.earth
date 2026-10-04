# Hru

## Sources

Gaia's parallax, brightness and spectrum give it 6.1 solar radii and 6.25 solar masses (FLAME) and 16,195 K at its surface (GSP-Phot). It is also HD 185507, HR 7474, HIP 96665. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4291462091610511744, parallax 4.156 ± 0.077 mas (240.63 pc). Radius 6.119 (6.013 to 6.228) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 6.246 (6.147 to 6.362) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 16,195 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 4291462091610511744: teff_gspphot 16194.543 K (16th-84th percentiles 15999.62-16440.488), the temperature FLAME used. log g 3.66 from the mass and radius.

**Color.** A Planck spectrum at 16,195 K, because gSP-Phot fits an extinction A_G = 0.52 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #b2c7ff. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 16,195 K and log g 3.66 (u1 0.140, u2 0.284): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Sigma Aquilae" (revision 1374808306) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
