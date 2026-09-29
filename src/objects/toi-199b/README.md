# TOI-199 b

## Sources

It is one of 2 planets known around TOI-199. Its orbit and size follow Hobson et al. 2023's fit, the archive's default. This account was drafted from Hobson et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.81 Jupiter radii from Hobson et al. 2023 (2023AJ....166..201H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..201H/abstract): 57,908.5 km at 71,492 km per Jupiter radius. GM from the mass 0.17 Jupiter masses (Hobson et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166..201H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166..201H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 104.87242523178 d Hobson et al. 2023 (2023AJ....166..201H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): a/R* derived from its semi-major axis 0.4254 au and stellar radius 0.82 solar radii; Hobson et al. 2023 (2023AJ....166..201H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): inclination 90 degrees Hobson et al. 2023 (2023AJ....166..201H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): e 0.09 Hobson et al. 2023 (2023AJ....166..201H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): omega 350 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460877.951041 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-199's measured colour (#ffe3d1, the colour lens of toi-199 (src/objects/toi-199/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-199's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (96, 97, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-199b.json).


## Known problems

- **Orbit convention.** omega 350 degrees is taken as Hobson et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.09) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
