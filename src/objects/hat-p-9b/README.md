# HAT-P-9 b

## Sources

It is the only planet known around Tevel. Its orbit and size follow Wang et al. 2019's fit, the archive's default. The introduction is generated from Wang et al. 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 1.393 Jupiter radii from Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract): 99,588.4 km at 71,492 km per Jupiter radius. GM from the mass 0.749 Jupiter masses (Wang et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019AJ....157...82W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 3.92281131 d Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): a/R* 8.5; Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): inclination 86.44 degrees Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): e 0.084 Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): omega 152 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2456489.15311 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hat-p-9's measured color (#fcf6ff, the color dataset of hat-p-9 (src/objects/hat-p-9/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Tevel's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (20, 47, 60), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-9b.json).


## Known problems

- **Orbit convention.** omega 152 degrees is taken as Wang et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.084) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-9b" (revision 1348849144) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
