# TOI-1408 b

## Sources

It is one of 2 planets known around TOI-1408. Its orbit and size follow Korth et al. 2024's fit, the archive's default. The introduction is generated from Korth et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 2.23035445 Jupiter radii from Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...971L..28K/abstract): 159,452.5 km at 71,492 km per Jupiter radius. GM from the mass 1.86578665 Jupiter masses (Korth et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJ...971L..28K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJ...971L..28K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.4247042 d Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): a/R* 8.13; Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): inclination 82.4 degrees Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): e 0.0023 Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): omega 170 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460661.181674 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1408's measured color (#faf5ff, the color dataset of toi-1408 (src/objects/toi-1408/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1408's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (84, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1408b.json).

## Known problems

- **Orbit convention.** omega 170 degrees is taken as Korth et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0023) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
