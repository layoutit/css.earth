# Yildun

## Sources

Gaia's parallax, brightness and spectrum give it 3.0 solar radii and 2.40 solar masses (FLAME) and 8,880 K at its surface (GSP-Phot). It is also HD 166205, HR 6789, HIP 85822. The introduction is generated from Creevey et al. (2023), A&A 674, A26 (Gaia DR3 FLAME)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1724851173788449536, parallax 17.880 ± 0.092 mas (55.93 pc). Radius 2.996 (2.934 to 3.057) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Mass 2.397 (2.357 to 2.437) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 8,880 K from Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), astrophysical_parameters of Gaia DR3 1724851173788449536: teff_gspphot 8879.579 K (16th-84th percentiles 8875.695-8883.538), the temperature FLAME used. log g 3.86 from the mass and radius.

**Color.** A Planck spectrum at 8,880 K, because gSP-Phot fits an extinction A_G = 0.00 mag toward this star (Andrae et al. (2023), A&A 674, A27 (Gaia DR3 GSP-Phot), ag_gspphot), and the color routes do not remove extinction; GSP-Phot measured its temperature, through the CIE 1931 2° observer: #d7e0ff. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,880 K and log g 3.86 (u1 0.284, u2 0.316): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Yildun" (revision 1360521973) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
