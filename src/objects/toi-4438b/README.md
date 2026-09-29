# TOI-4438 b

## Sources

It is the only planet known around TOI-4438. Its orbit and size follow Serrano Bell et al. 2026's fit, the archive's default. This account was drafted from Serrano Bell et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.21411403 Jupiter radii from Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260713333S/abstract): 15,307.4 km at 71,492 km per Jupiter radius. GM from the mass 0.01293151 Jupiter masses (Serrano Bell et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026arXiv260713333S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026arXiv260713333S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): P 7.446295 d Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): a/R* derived from its semi-major axis 0.0523 au and stellar radius 0.365 solar radii; Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): inclination 89.7 degrees Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): e 0.07 Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): omega -86 degrees, stored as 274 Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): transit mid-time 2459396.41069 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4438's measured colour (#ffcb88, the colour lens of toi-4438 (src/objects/toi-4438/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4438's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (53, 79, 80), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4438b.json).


## Known problems

- **Orbit convention.** omega -86 degrees is taken as Serrano Bell et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.07) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
