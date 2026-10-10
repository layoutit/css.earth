# Kepler-90 g

## Sources

Kepler-90 g is one of 8 planets known around Kepler-90. Its orbit and size follow Shaw et al. 2025's fit, the NASA Exoplanet Archive's default set.

**Size and mass.** Radius 0.68855503 Jupiter radii from Weiss et al. 2024 (2024ApJS..270....8W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..270....8W/abstract): 49,226.2 km at 71,492 km per Jupiter radius. GM from the mass 0.04719528 Jupiter masses (Shaw et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025AJ....170..146S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025AJ....170..146S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Shaw et al. 2025 (2025AJ....170..146S), via the NASA Exoplanet Archive ps table (pl_refname SHAW_ET_AL__2025): P 210.73514 d Liang et al. 2021 (2021AJ....161..202L), via the NASA Exoplanet Archive ps table (pl_refname LIANG_ET_AL__2021): a/R* derived by Kepler's third law from its period 210.73514 d, stellar mass 1.2 and radius 1.2 solar units; Liang et al. 2021 (2021AJ....161..202L), via the NASA Exoplanet Archive ps table (pl_refname LIANG_ET_AL__2021): inclination 89.92 degrees Shaw et al. 2025 (2025AJ....170..146S), via the NASA Exoplanet Archive ps table (pl_refname SHAW_ET_AL__2025): e 0.0292 Shaw et al. 2025 (2025AJ....170..146S), via the NASA Exoplanet Archive ps table (pl_refname SHAW_ET_AL__2025): omega 114.6 degrees Shaw et al. 2025 (2025AJ....170..146S), via the NASA Exoplanet Archive ps table (pl_refname SHAW_ET_AL__2025): transit mid-time 2454979.97608 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by kepler-90's measured color (#fff5f9, the color dataset of kepler-90 (src/objects/kepler-90/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Kepler-90's planets from above, from their hosted-orbit records, and its transit in 14 Kepler quarters (1 to 7, 9 to 11, 13 to 15, 17), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-10 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-90g.json).


## Known problems

- **Smeared transit chart.** The chart folds five Kepler transits on one fixed period, but this planet's transits do not keep one: Cabrera et al. (2014) found its period changed by 25.7 hours between two consecutive transits, because Kepler-90 h pulls on it. The folded dip is therefore spread over about 19 hours, with bin errors near 970 ppm in the middle of the transit against about 245 ppm outside it. The chart shows that a dip exists; it does not show the shape or depth of one transit.
- **Orbit convention.** omega 114.6 degrees is taken as Shaw et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0292) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-90g" (revision 1328173004) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
