# TOI-1749 d

## Sources

It is one of 3 planets known around TOI-1749. Its orbit and size follow Fukui et al. 2021's fit, the archive's default. This account was drafted from Fukui et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.22481973 Jupiter radii from Fukui et al. 2021 (2021AJ....162..167F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..167F/abstract): 16,072.8 km at 71,492 km per Jupiter radius. No mass is measured: Fukui et al. 2021 (2021AJ....162..167F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..167F/abstract) gives only an upper limit of 0.04719528 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 9.04470385496 d Fukui et al. 2021 (2021AJ....162..167F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_ET_AL__2021): a/R* derived from its semi-major axis 0.0707 au and stellar radius 0.55 solar radii; Fukui et al. 2021 (2021AJ....162..167F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_ET_AL__2021): inclination 88.53 degrees Fukui et al. 2021 (2021AJ....162..167F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_ET_AL__2021): e 0.062 Fukui et al. 2021 (2021AJ....162..167F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_ET_AL__2021): omega 40 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459647.515197 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1749's measured colour (#ffbe8c, the colour lens of toi-1749 (src/objects/toi-1749/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1749's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (84, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1749d.json).


## Known problems

- **Orbit convention.** omega 40 degrees is taken as Fukui et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.062) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
