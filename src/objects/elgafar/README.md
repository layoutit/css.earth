# Elgafar

## Sources

Gaia's parallax, brightness and spectrum give it 4.2 solar radii and 1.84 solar masses (FLAME) and 5,477 K at its surface (GSP-Phot). It is also HD 126868, HR 5409, HIP 70755. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3649422995468596480, parallax 26.879 ± 0.126 mas (37.20 pc). Radius 4.243 (4.157 to 4.330) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 1.843 (1.784 to 1.883) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 5,477 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 3649422995468596480: teff_gspphot 5477.121 K (16th-84th percentiles 5475.831-5478.321), the temperature FLAME used. log g 3.45 from the mass and radius.

**Color.** A Planck spectrum at 5,477 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #ffede0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,477 K and log g 3.45 (u1 0.512, u2 0.227): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Phi Virginis" (revision 1374783357) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
