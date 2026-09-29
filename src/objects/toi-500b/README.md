# TOI-500 b

## Sources

It is one of 4 planets known around TOI-500. Its orbit and size follow Serrano et al. 2022's fit, the archive's default. This account was drafted from Serrano et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.10402373 Jupiter radii from Serrano et al. 2022 (2022NatAs...6..736S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022NatAs...6..736S/abstract): 7,436.9 km at 71,492 km per Jupiter radius. GM from the mass 0.00446782 Jupiter masses (Serrano et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022NatAs...6..736S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022NatAs...6..736S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): P 0.5481579 d Serrano et al. 2022 (2022NatAs...6..736S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_ET_AL_2022): a/R* 3.769; Serrano et al. 2022 (2022NatAs...6..736S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_ET_AL_2022): inclination 82.09 degrees Serrano et al. 2022 (2022NatAs...6..736S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_ET_AL_2022): e 0.063 Serrano et al. 2022 (2022NatAs...6..736S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_ET_AL_2022): omega 228.5 degrees Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): transit mid-time 2458468.3917 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-500's measured colour (#ffcbab, the colour lens of toi-500 (src/objects/toi-500/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-500's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (61, 87, 88), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-500b.json).


## Known problems

- **Orbit convention.** omega 228.5 degrees is taken as Serrano et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.063) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
