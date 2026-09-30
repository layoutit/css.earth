# TOI-2141 b

## Sources

It is one of 3 planets known around TOI-2141. Its orbit and size follow Luque et al. 2025's fit, the archive's default. This account was drafted from Luque et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.28075702 Jupiter radii from Luque et al. 2025 (2025A&A...704A.174L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...704A.174L/abstract): 20,071.9 km at 71,492 km per Jupiter radius. GM from the mass 0.06324167 Jupiter masses (Luque et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...704A.174L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...704A.174L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Luque et al. 2025 (2025A&A...704A.174L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE_ET_AL_2025): P 18.261608 d Luque et al. 2025 (2025A&A...704A.174L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE_ET_AL_2025): a/R* 29.93; Luque et al. 2025 (2025A&A...704A.174L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE_ET_AL_2025): inclination 88.755 degrees Martioli et al. 2023 (2023A&A...680A..84M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2023): e 0.21 Martioli et al. 2023 (2023A&A...680A..84M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2023): omega 90 degrees Luque et al. 2025 (2025A&A...704A.174L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE_ET_AL_2025): transit mid-time 2458992.502 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2141's measured colour (#fff2f0, the colour dataset of toi-2141 (src/objects/toi-2141/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2141's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (26, 52, 79), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2141b.json).


## Known problems

- **Orbit convention.** omega 90 degrees is taken as Martioli et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.21) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
