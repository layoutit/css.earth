# TOI-1710 b

## Sources

It is the only planet known around TOI-1710. Its orbit and size follow Espinoza-Retamal et al. 2026's fit, the archive's default. The introduction is generated from Espinoza-Retamal et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.45142374 Jupiter radii from Espinoza-Retamal et al. 2026 (2026ApJ..1005L..15E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026ApJ..1005L..15E/abstract): 32,273.2 km at 71,492 km per Jupiter radius. GM from the mass 0.06009532 Jupiter masses (Espinoza-Retamal et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026ApJ..1005L..15E), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026ApJ..1005L..15E/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 24.2833782 d Espinoza-Retamal et al. 2026 (2026ApJ..1005L..15E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): a/R* 38; Espinoza-Retamal et al. 2026 (2026ApJ..1005L..15E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): inclination 90.01 degrees Espinoza-Retamal et al. 2026 (2026ApJ..1005L..15E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): e 0.05 Espinoza-Retamal et al. 2026 (2026ApJ..1005L..15E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): omega -62 degrees, stored as 298 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460439.666809 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1710's measured colour (#fff2ef, the colour dataset of toi-1710 (src/objects/toi-1710/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1710's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (60, 73, 79), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1710b.json).

## Known problems

- **Orbit convention.** omega -62 degrees is taken as Espinoza-Retamal et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.05) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
