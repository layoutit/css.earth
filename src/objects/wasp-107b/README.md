# WASP-107 b

## Sources

It is one of 2 planets known around WASP-107. Its orbit and size follow Yee & Vissapragada 2026's fit, the archive's default. This account was drafted from Yee & Vissapragada 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.935 Jupiter radii from Yee & Vissapragada 2026 (2026ApJ..1000L..54Y), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026ApJ..1000L..54Y/abstract): 66,845 km at 71,492 km per Jupiter radius. GM from the mass 0.1039 Jupiter masses (Yee & Vissapragada 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026ApJ..1000L..54Y), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026ApJ..1000L..54Y/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): P 5.7214876 d Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): a/R* 16.5; Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): inclination 89.55 degrees Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): e 0.09 Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): omega 79.3 degrees Wu et al. 2026 (2026ApJ...996L..28W), via the NASA Exoplanet Archive ps table (pl_refname WU_ET_AL_2026): transit mid-time 2459958.74727 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-107's measured colour (#ffc49e, the colour lens of wasp-107 (src/objects/wasp-107/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-107's planets from above, from their hosted-orbit records, and its transmission spectrum, 49 bins from Spake et al. 2018 in the archive's transitspec table, the most of its 2 papers; its transit in 1 TESS sector (91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-107b.json).


## Known problems

- **Orbit convention.** omega 79.3 degrees is taken as Wu et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.09) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
