# TOI-5349 b

## Sources

It is the only planet known around TOI-5349. Its orbit and size follow Sandoval et al. 2026's fit, the archive's default. This account was drafted from Sandoval et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.91 Jupiter radii from Sandoval et al. 2026 (2026AJ....171...43S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....171...43S/abstract): 65,057.7 km at 71,492 km per Jupiter radius. GM from the mass 0.4 Jupiter masses (Sandoval et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026AJ....171...43S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026AJ....171...43S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Sandoval et al. 2026 (2026AJ....171...43S), via the NASA Exoplanet Archive ps table (pl_refname SANDOVAL_ET_AL_2026): P 3.317921 d Sandoval et al. 2026 (2026AJ....171...43S), via the NASA Exoplanet Archive ps table (pl_refname SANDOVAL_ET_AL_2026): a/R* 13.6; Sandoval et al. 2026 (2026AJ....171...43S), via the NASA Exoplanet Archive ps table (pl_refname SANDOVAL_ET_AL_2026): inclination 87.9 degrees Sandoval et al. 2026 (2026AJ....171...43S), via the NASA Exoplanet Archive ps table (pl_refname SANDOVAL_ET_AL_2026): e 0.03 Sandoval et al. 2026 (2026AJ....171...43S), via the NASA Exoplanet Archive ps table (pl_refname SANDOVAL_ET_AL_2026): omega -50 degrees, stored as 310 Sandoval et al. 2026 (2026AJ....171...43S), via the NASA Exoplanet Archive ps table (pl_refname SANDOVAL_ET_AL_2026): transit mid-time 2459521.8184 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5349's measured colour (#ffc085, the colour lens of toi-5349 (src/objects/toi-5349/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5349's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (70, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5349b.json).


## Known problems

- **Orbit convention.** omega -50 degrees is taken as Sandoval et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.03) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
