# TOI-1231 b

## Sources

It is the only planet known around TOI-1231. Its orbit and size follow Burt et al. 2021's fit, the archive's default. This account was drafted from Burt et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.32563175 Jupiter radii from Burt et al. 2021 (2021AJ....162...87B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162...87B/abstract): 23,280.1 km at 71,492 km per Jupiter radius. GM from the mass 0.04845382 Jupiter masses (Burt et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....162...87B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....162...87B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Burt et al. 2021 (2021AJ....162...87B), via the NASA Exoplanet Archive ps table (pl_refname BURT_ET_AL__2021): P 24.245586 d Burt et al. 2021 (2021AJ....162...87B), via the NASA Exoplanet Archive ps table (pl_refname BURT_ET_AL__2021): a/R* 58.1; Burt et al. 2021 (2021AJ....162...87B), via the NASA Exoplanet Archive ps table (pl_refname BURT_ET_AL__2021): inclination 89.73 degrees Burt et al. 2021 (2021AJ....162...87B), via the NASA Exoplanet Archive ps table (pl_refname BURT_ET_AL__2021): e 0.087 Burt et al. 2021 (2021AJ....162...87B), via the NASA Exoplanet Archive ps table (pl_refname BURT_ET_AL__2021): omega 176 degrees Burt et al. 2021 (2021AJ....162...87B), via the NASA Exoplanet Archive ps table (pl_refname BURT_ET_AL__2021): transit mid-time 2458685.1163 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1231's measured colour (#ffc990, the colour dataset of toi-1231 (src/objects/toi-1231/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1231's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (63, 90, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1231b.json).


## Known problems

- **Orbit convention.** omega 176 degrees is taken as Burt et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.087) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
