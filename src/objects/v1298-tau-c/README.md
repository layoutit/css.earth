# V1298 Tau c

## Sources

It is one of 4 planets known around V1298 Tau. Its orbit and size follow Livingston et al. 2026's fit, the archive's default. This account was drafted from Livingston et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.45320802 Jupiter radii from Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract): 32,400.7 km at 71,492 km per Jupiter radius. GM from the mass 0.01478785 Jupiter masses (Livingston et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026Natur.649..310L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026Natur.649..310L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL_2026): P 8.249164 d Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL_2026): a/R* derived from its semi-major axis 0.0824 au and stellar radius 1.32 solar radii; Suárez Mascareño et al. 2022 (2022NatAs...6..232S), via the NASA Exoplanet Archive ps table (pl_refname SU_AACUTE_REZ_MASCARE_NTILDE_O_ET_AL__2022): inclination 87.5 degrees Feinstein et al. 2021 (2021AJ....162..213F), via the NASA Exoplanet Archive ps table (pl_refname FEINSTEIN_ET_AL__2021): e 0.1 Feinstein et al. 2021 (2021AJ....162..213F), via the NASA Exoplanet Archive ps table (pl_refname FEINSTEIN_ET_AL__2021): omega 87.84 degrees Livingston et al. 2026 (2026Natur.649..310L), via the NASA Exoplanet Archive ps table (pl_refname LIVINGSTON_ET_AL_2026): transit mid-time 2458293.341238 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by v1298-tau's measured colour (#ffe6cf, the colour dataset of v1298-tau (src/objects/v1298-tau/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of V1298 Tau's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (43, 44), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/v1298-tau-c.json).


## Known problems

- **Orbit convention.** omega 87.84 degrees is taken as Feinstein et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.1) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
