# WASP-2 b

## Sources

It is the only planet known around WASP-2. Its orbit and size follow Addison et al. 2019's fit, the archive's default. The introduction is generated from Addison et al. 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 1.081 Jupiter radii from Addison et al. 2019 (2019PASP..131k5003A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019PASP..131k5003A/abstract): 77,282.9 km at 71,492 km per Jupiter radius. GM from the mass 0.931 Jupiter masses (Addison et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019PASP..131k5003A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019PASP..131k5003A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.15222216 d Addison et al. 2019 (2019PASP..131k5003A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2019): a/R* 7.81; Addison et al. 2019 (2019PASP..131k5003A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2019): inclination 84.49 degrees Knutson et al. 2014 (2014ApJ...785..126K), via the NASA Exoplanet Archive ps table (pl_refname KNUTSON_ET_AL__2014): e 0.0054 Knutson et al. 2014 (2014ApJ...785..126K), via the NASA Exoplanet Archive ps table (pl_refname KNUTSON_ET_AL__2014): omega 267 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2455229.043082 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-2's measured colour (#ffe3d1, the colour dataset of wasp-2 (src/objects/wasp-2/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-2's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (54, 81), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-2b.json).

## Known problems

- **Orbit convention.** omega 267 degrees is taken as Knutson et al. 2014 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0054) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-2b" (revision 1374238799) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
