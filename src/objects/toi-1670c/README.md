# TOI-1670 c

## Sources

It is one of 2 planets known around TOI-1670. Its orbit and size follow Tran et al. 2022's fit, the archive's default. This account was drafted from Tran et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.987 Jupiter radii from Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..225T/abstract): 70,562.6 km at 71,492 km per Jupiter radius. GM from the mass 0.63 Jupiter masses (Tran et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022AJ....163..225T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022AJ....163..225T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 40.7501028 d Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): a/R* 40.68; Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): inclination 88.84 degrees Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): e 0.09 Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): omega 105.5 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460503.136603 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1670's measured colour (#f6f2ff, the colour lens of toi-1670 (src/objects/toi-1670/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1670's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (84, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1670c.json).


## Known problems

- **Orbit convention.** omega 105.5 degrees is taken as Tran et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.09) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
