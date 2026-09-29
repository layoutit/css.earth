# TOI-4427 b

## Sources

It is the only planet known around TOI-4427. Its orbit and size follow Guenther et al. 2026's fit, the archive's default. This account was drafted from Guenther et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 1.168 Jupiter radii from Guenther et al. 2026 (2026AJ....172...54G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172...54G/abstract): 83,502.7 km at 71,492 km per Jupiter radius. GM from the mass 0.276 Jupiter masses (Guenther et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026AJ....172...54G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026AJ....172...54G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Guenther et al. 2026 (2026AJ....172...54G), via the NASA Exoplanet Archive ps table (pl_refname GUENTHER_ET_AL_2026): P 4.6182621 d Guenther et al. 2026 (2026AJ....172...54G), via the NASA Exoplanet Archive ps table (pl_refname GUENTHER_ET_AL_2026): a/R* derived from its semi-major axis 0.05389 au and stellar radius 0.89 solar radii; Guenther et al. 2026 (2026AJ....172...54G), via the NASA Exoplanet Archive ps table (pl_refname GUENTHER_ET_AL_2026): inclination 87.4 degrees Guenther et al. 2026 (2026AJ....172...54G), via the NASA Exoplanet Archive ps table (pl_refname GUENTHER_ET_AL_2026): e 0.074 Guenther et al. 2026 (2026AJ....172...54G), via the NASA Exoplanet Archive ps table (pl_refname GUENTHER_ET_AL_2026): omega -75 degrees, stored as 285 Guenther et al. 2026 (2026AJ....172...54G), via the NASA Exoplanet Archive ps table (pl_refname GUENTHER_ET_AL_2026): transit mid-time 2459598.712954 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4427's measured colour (#ffe9da, the colour lens of toi-4427 (src/objects/toi-4427/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4427's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (53, 60, 74), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4427b.json).


## Known problems

- **Orbit convention.** omega -75 degrees is taken as Guenther et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.074) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
