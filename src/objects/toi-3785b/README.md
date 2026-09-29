# TOI-3785 b

## Sources

It is the only planet known around TOI-3785. Its orbit and size follow Powers et al. 2023's fit, the archive's default. This account was drafted from Powers et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.45856088 Jupiter radii from Powers et al. 2023 (2023AJ....166...44P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...44P/abstract): 32,783.4 km at 71,492 km per Jupiter radius. GM from the mass 0.04703796 Jupiter masses (Powers et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166...44P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166...44P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Powers et al. 2023 (2023AJ....166...44P), via the NASA Exoplanet Archive ps table (pl_refname POWERS_ET_AL__2023): P 4.6747373 d Powers et al. 2023 (2023AJ....166...44P), via the NASA Exoplanet Archive ps table (pl_refname POWERS_ET_AL__2023): a/R* 18.89; Powers et al. 2023 (2023AJ....166...44P), via the NASA Exoplanet Archive ps table (pl_refname POWERS_ET_AL__2023): inclination 88.1 degrees Powers et al. 2023 (2023AJ....166...44P), via the NASA Exoplanet Archive ps table (pl_refname POWERS_ET_AL__2023): e 0.11 Powers et al. 2023 (2023AJ....166...44P), via the NASA Exoplanet Archive ps table (pl_refname POWERS_ET_AL__2023): omega 96.26 degrees Powers et al. 2023 (2023AJ....166...44P), via the NASA Exoplanet Archive ps table (pl_refname POWERS_ET_AL__2023): transit mid-time 2458861.49553 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-3785's measured colour (#ffc78a, the colour lens of toi-3785 (src/objects/toi-3785/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-3785's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (47, 74), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-3785b.json).


## Known problems

- **Orbit convention.** omega 96.26 degrees is taken as Powers et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.11) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
