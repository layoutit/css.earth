# GJ 1132 b

## Sources

It is one of 2 planets known around GJ 1132. Its orbit and size follow Xue et al. 2024's fit, the archive's default. The introduction is generated from Xue et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.1063 Jupiter radii from Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L...8X/abstract): 7,599.6 km at 71,492 km per Jupiter radius. GM from the mass 0.00578 Jupiter masses (Xue et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJ...973L...8X), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJ...973L...8X/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): P 1.62892911 d Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): a/R* 15.26; Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): inclination 88.16 degrees Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): e 0.0118 Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): omega -95.8 degrees, stored as 264.2 Xue et al. 2024 (2024ApJ...973L...8X), via the NASA Exoplanet Archive ps table (pl_refname XUE_ET_AL_2024): transit mid-time 2459280.98988 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-1132's measured color (#ffc778, the color dataset of gj-1132 (src/objects/gj-1132/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of GJ 1132's planets from above, from their hosted-orbit records, and its transmission spectrum, 17 bins from Diamond-Lowe et al. 2018 in the archive's transitspec table; its transit in 3 TESS sectors (63, 90, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-1132b.json).

## Known problems

- **Orbit convention.** omega -95.8 degrees is taken as Xue et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0118) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "GJ 1132 b" (revision 1375986378) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
