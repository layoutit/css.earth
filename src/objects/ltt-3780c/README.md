# LTT 3780 c

## Sources

It is one of 2 planets known around LTT 3780. Its orbit and size follow Bonfanti et al. 2024's fit, the archive's default. The introduction is generated from Bonfanti et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.21322189 Jupiter radii from Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...682A..66B/abstract): 15,243.7 km at 71,492 km per Jupiter radius. GM from the mass 0.02529667 Jupiter masses (Bonfanti et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...682A..66B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...682A..66B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Weisserman et al. 2026 (2026A&A...709A.165W), via the NASA Exoplanet Archive ps table (pl_refname WEISSERMAN_ET_AL_2026): P 12.25228 d Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): a/R* 43; Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): inclination 88.958 degrees Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): e 0.024 Bonfanti et al. 2024 (2024A&A...682A..66B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2024): omega -66 degrees, stored as 294 Weisserman et al. 2026 (2026A&A...709A.165W), via the NASA Exoplanet Archive ps table (pl_refname WEISSERMAN_ET_AL_2026): transit mid-time 2459600.5423 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by ltt-3780's measured colour (#ffce8c, the colour dataset of ltt-3780 (src/objects/ltt-3780/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of LTT 3780's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (62, 89, 100), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ltt-3780c.json).

## Known problems

- **Orbit convention.** omega -66 degrees is taken as Bonfanti et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.024) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
