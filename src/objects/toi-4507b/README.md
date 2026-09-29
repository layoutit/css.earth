# TOI-4507 b

## Sources

It is the only planet known around TOI-4507. Its orbit and size follow Espinoza-Retamal et al. 2026's fit, the archive's default. This account was drafted from Espinoza-Retamal et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.73155626 Jupiter radii from Espinoza-Retamal et al. 2026 (2026ApJ...996L..13E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026ApJ...996L..13E/abstract): 52,300.4 km at 71,492 km per Jupiter radius. No mass is measured: Espinoza-Retamal et al. 2026 (2026ApJ...996L..13E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026ApJ...996L..13E/abstract) gives only an upper limit of 0.06292704 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Rea et al. 2026 (2026A&A...711A..86R), via the NASA Exoplanet Archive ps table (pl_refname REA_ET_AL_2026): P 104.616063 d Espinoza-Retamal et al. 2026 (2026ApJ...996L..13E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): a/R* 93.4; Espinoza-Retamal et al. 2026 (2026ApJ...996L..13E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): inclination 89.93 degrees Espinoza-Retamal et al. 2026 (2026ApJ...996L..13E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): e 0.09 Espinoza-Retamal et al. 2026 (2026ApJ...996L..13E), via the NASA Exoplanet Archive ps table (pl_refname ESPINOZA_RETAMAL_ET_AL_2026): omega -123 degrees, stored as 237 Rea et al. 2026 (2026A&A...711A..86R), via the NASA Exoplanet Archive ps table (pl_refname REA_ET_AL_2026): transit mid-time 2459669.24457 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4507's measured colour (#fff7ff, the colour lens of toi-4507 (src/objects/toi-4507/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4507's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (96, 97, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4507b.json).


## Known problems

- **Orbit convention.** omega -123 degrees is taken as Espinoza-Retamal et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.09) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-4507 b" (revision 1374091145), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
