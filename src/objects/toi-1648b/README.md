# TOI-1648 b

## Sources

It is the only planet known around TOI-1648. Its orbit and size follow Carleo et al. 2026's fit, the archive's default. This account was drafted from Carleo et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.227 Jupiter radii from Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.549f1958C/abstract): 16,228.7 km at 71,492 km per Jupiter radius. GM from the mass 0.0233 Jupiter masses (Carleo et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026MNRAS.549f1958C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026MNRAS.549f1958C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 7.3315684 d Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): a/R* 26.4; Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): inclination 88.29 degrees Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): e 0.178 Carleo et al. 2026 (2026MNRAS.549f1958C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL_2026): omega 286 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460467.880926 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1648's measured colour (#ffdbc2, the colour dataset of toi-1648 (src/objects/toi-1648/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1648's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (59, 79, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1648b.json).


## Known problems

- **Orbit convention.** omega 286 degrees is taken as Carleo et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.178) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
