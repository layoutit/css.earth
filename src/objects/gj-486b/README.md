# GJ 486 b

## Sources

It is the only planet known around Gar. Its orbit and size follow Weiner Mansfield et al. 2024's fit, the archive's default. The introduction is generated from Weiner Mansfield et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.11499708 Jupiter radii from Weiner Mansfield et al. 2024 (2024ApJ...975L..22W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...975L..22W/abstract): 8,221.4 km at 71,492 km per Jupiter radius. GM from the mass 0.00871539 Jupiter masses (Weiner Mansfield et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJ...975L..22W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJ...975L..22W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Weiner Mansfield et al. 2024 (2024ApJ...975L..22W), via the NASA Exoplanet Archive ps table (pl_refname WEINER_MANSFIELD_ET_AL__2024): P 1.46712127 d Weiner Mansfield et al. 2024 (2024ApJ...975L..22W), via the NASA Exoplanet Archive ps table (pl_refname WEINER_MANSFIELD_ET_AL__2024): a/R* 11.38; Weiner Mansfield et al. 2024 (2024ApJ...975L..22W), via the NASA Exoplanet Archive ps table (pl_refname WEINER_MANSFIELD_ET_AL__2024): inclination 89.39 degrees Weiner Mansfield et al. 2024 (2024ApJ...975L..22W), via the NASA Exoplanet Archive ps table (pl_refname WEINER_MANSFIELD_ET_AL__2024): e 0.00086 Weiner Mansfield et al. 2024 (2024ApJ...975L..22W), via the NASA Exoplanet Archive ps table (pl_refname WEINER_MANSFIELD_ET_AL__2024): omega 14 degrees Weiner Mansfield et al. 2024 (2024ApJ...975L..22W), via the NASA Exoplanet Archive ps table (pl_refname WEINER_MANSFIELD_ET_AL__2024): transit mid-time 2459939.071602 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-486's measured color (#ffcd89, the color dataset of gj-486 (src/objects/gj-486/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Gar's planets from above, from their hosted-orbit records, and its transmission spectrum, 203 bins from Moran et al. 2023 in the archive's transitspec table; its transit in 2 TESS sectors (23, 50), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-486b.json).


## Known problems

- **Orbit convention.** omega 14 degrees is taken as Weiner Mansfield et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.00086) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Gliese 486 b" (revision 1374088228) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
