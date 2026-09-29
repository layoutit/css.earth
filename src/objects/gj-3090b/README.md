# GJ 3090 b

## Sources

It is one of 2 planets known around GJ 3090. Its orbit and size follow Lamontagne et al. 2026's fit, the archive's default. This account was drafted from Lamontagne et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.19448691 Jupiter radii from Lamontagne et al. 2026 (2026A&A...706A.278L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...706A.278L/abstract): 13,904.3 km at 71,492 km per Jupiter radius. GM from the mass 0.01422151 Jupiter masses (Lamontagne et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026A&A...706A.278L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026A&A...706A.278L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Lamontagne et al. 2026 (2026A&A...706A.278L), via the NASA Exoplanet Archive ps table (pl_refname LAMONTAGNE_ET_AL_2026): P 2.85310198 d Lamontagne et al. 2026 (2026A&A...706A.278L), via the NASA Exoplanet Archive ps table (pl_refname LAMONTAGNE_ET_AL_2026): a/R* derived from its semi-major axis 0.0316 au and stellar radius 0.516 solar radii; Lamontagne et al. 2026 (2026A&A...706A.278L), via the NASA Exoplanet Archive ps table (pl_refname LAMONTAGNE_ET_AL_2026): inclination 86.9 degrees Lamontagne et al. 2026 (2026A&A...706A.278L), via the NASA Exoplanet Archive ps table (pl_refname LAMONTAGNE_ET_AL_2026): e 0.25 Lamontagne et al. 2026 (2026A&A...706A.278L), via the NASA Exoplanet Archive ps table (pl_refname LAMONTAGNE_ET_AL_2026): omega 90 degrees Lamontagne et al. 2026 (2026A&A...706A.278L), via the NASA Exoplanet Archive ps table (pl_refname LAMONTAGNE_ET_AL_2026): transit mid-time 2458356.15322 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by gj-3090's measured colour (#ffc188, the colour lens of gj-3090 (src/objects/gj-3090/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of GJ 3090's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (103, 104, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-3090b.json).


## Known problems

- **Orbit convention.** omega 90 degrees is taken as Lamontagne et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.25) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
