# TOI-3235 b

## Sources

It is the only planet known around TOI-3235. Its orbit and size follow Hobson et al. 2023's fit, the archive's default. This account was drafted from Hobson et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 1.017 Jupiter radii from Hobson et al. 2023 (2023ApJ...946L...4H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023ApJ...946L...4H/abstract): 72,707.4 km at 71,492 km per Jupiter radius. GM from the mass 0.665 Jupiter masses (Hobson et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023ApJ...946L...4H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023ApJ...946L...4H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hobson et al. 2023 (2023ApJ...946L...4H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): P 2.59261842 d Hobson et al. 2023 (2023ApJ...946L...4H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): a/R* 15.75; Hobson et al. 2023 (2023ApJ...946L...4H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): inclination 88.14 degrees Ko et al. 2026 (2026AJ....172..174K), via the NASA Exoplanet Archive ps table (pl_refname KO_ET_AL_2026): e 0.03 Ko et al. 2026 (2026AJ....172..174K), via the NASA Exoplanet Archive ps table (pl_refname KO_ET_AL_2026): omega 90 degrees Hobson et al. 2023 (2023ApJ...946L...4H), via the NASA Exoplanet Archive ps table (pl_refname HOBSON_ET_AL_2023): transit mid-time 2459690.00173 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-3235's measured colour (#ffc985, the colour lens of toi-3235 (src/objects/toi-3235/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-3235's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (64, 101, 102), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-3235b.json).


## Known problems

- **Orbit convention.** omega 90 degrees is taken as Ko et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.03) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-3235 b" (revision 1374086867), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
