# K2-32 b

## Sources

It is one of 4 planets known around K2-32. Its orbit and size follow Lillo-Box et al. 2020's fit, the archive's default. This account was drafted from Lillo-Box et al. 2020's values; the sections below are the data's own.

**Size and mass.** Radius 0.47274593 Jupiter radii from Lillo-Box et al. 2020 (2020A&A...640A..48L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...640A..48L/abstract): 33,797.6 km at 71,492 km per Jupiter radius. GM from the mass 0.04719528 Jupiter masses (Lillo-Box et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020A&A...640A..48L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020A&A...640A..48L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Howard et al. 2025 (2025ApJS..278...52H), via the NASA Exoplanet Archive ps table (pl_refname HOWARD_ET_AL__2025): P 8.99196 d Lillo-Box et al. 2020 (2020A&A...640A..48L), via the NASA Exoplanet Archive ps table (pl_refname LILLO_BOX_ET_AL__2020): a/R* 19.86; Lillo-Box et al. 2020 (2020A&A...640A..48L), via the NASA Exoplanet Archive ps table (pl_refname LILLO_BOX_ET_AL__2020): inclination 89 degrees Lillo-Box et al. 2020 (2020A&A...640A..48L), via the NASA Exoplanet Archive ps table (pl_refname LILLO_BOX_ET_AL__2020): e 0.03 Lillo-Box et al. 2020 (2020A&A...640A..48L), via the NASA Exoplanet Archive ps table (pl_refname LILLO_BOX_ET_AL__2020): omega 220 degrees Howard et al. 2025 (2025ApJS..278...52H), via the NASA Exoplanet Archive ps table (pl_refname HOWARD_ET_AL__2025): transit mid-time 2456909.91884 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 46 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-32's measured colour (#ffdec4, the colour lens of k2-32 (src/objects/k2-32/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-32's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-32b.json).


## Known problems

- **Orbit convention.** omega 220 degrees is taken as Lillo-Box et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.03) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "K2-32" (revision 1374406472), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
