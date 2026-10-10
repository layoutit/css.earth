# Kepler-90 h

## Sources

It is one of 8 planets known around Kepler-90. Its orbit and size follow Shaw et al. 2025's fit, the archive's default. The introduction is generated from Shaw et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 1.00383793 Jupiter radii from Weiss et al. 2024 (2024ApJS..270....8W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..270....8W/abstract): 71,766.4 km at 71,492 km per Jupiter radius. GM from the mass 0.63870943 Jupiter masses (Shaw et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025AJ....170..146S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025AJ....170..146S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Q1-Q17 DR25 Supplemental KOI Table, via the NASA Exoplanet Archive ps table (pl_refname Q1_Q17_DR25_SUPPLEMENTAL_KOI_TABLE): P 331.5972732 d Liang et al. 2021 (2021AJ....161..202L), via the NASA Exoplanet Archive ps table (pl_refname LIANG_ET_AL__2021): a/R* derived by Kepler's third law from its period 331.5972732 d, stellar mass 1.2 and radius 1.2 solar units; Liang et al. 2021 (2021AJ....161..202L), via the NASA Exoplanet Archive ps table (pl_refname LIANG_ET_AL__2021): inclination 89.927 degrees Shaw et al. 2025 (2025AJ....170..146S), via the NASA Exoplanet Archive ps table (pl_refname SHAW_ET_AL__2025): e 0.0276 Shaw et al. 2025 (2025AJ....170..146S), via the NASA Exoplanet Archive ps table (pl_refname SHAW_ET_AL__2025): omega 119 degrees Q1-Q17 DR25 Supplemental KOI Table, via the NASA Exoplanet Archive ps table (pl_refname Q1_Q17_DR25_SUPPLEMENTAL_KOI_TABLE): transit mid-time 2454973.498929 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by kepler-90's measured color (#fff5f9, the color dataset of kepler-90 (src/objects/kepler-90/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Kepler-90's planets from above, from their hosted-orbit records, and its transit in 14 Kepler quarters (1 to 7, 9 to 11, 13 to 15, 17), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-10 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-90h.json).


## Known problems

- **Orbit convention.** omega 119 degrees is taken as Shaw et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0276) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-90h" (revision 1370781363) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
