# V1298 Tau d

## Sources

It is one of 4 planets known around V1298 Tau. Its orbit and size follow Livingston et al. 2026's fit, the archive's default. The introduction is generated from Livingston et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.58256858 Jupiter radii from Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract): 41,649 km at 71,492 km per Jupiter radius. GM from the mass 0.01887811 Jupiter masses (Livingston et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026Natur.649..310L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL_2026): P 12.401394 d Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL_2026): a/R* derived from its semi-major axis 0.1081 au and stellar radius 1.32 solar radii; Suárez Mascareño et al. 2022 (2022NatAs...6..232S), via the NASA Exoplanet Archive ps table (pl_refname SU_AACUTE_REZ_MASCARE_NTILDE_O_ET_AL__2022): inclination 88.3 degrees David et al. 2019 (2019ApJ...885L..12D), via the NASA Exoplanet Archive ps table (pl_refname DAVID_ET_AL__2019): e 0.21 David et al. 2019 (2019ApJ...885L..12D), via the NASA Exoplanet Archive ps table (pl_refname DAVID_ET_AL__2019): omega 88 degrees Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL_2026): transit mid-time 2458287.802142 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by v1298-tau's measured color (#ffe6cf, the color dataset of v1298-tau (src/objects/v1298-tau/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of V1298 Tau's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (43, 44), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/v1298-tau-d.json).

## Known problems

- **Orbit convention.** omega 88 degrees is taken as David et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.21) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
