# TOI-5205 b

## Sources

It is the only planet known around TOI-5205. Its orbit and size follow Kanodia et al. 2023's fit, the archive's default. This account was drafted from Kanodia et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 1.03 Jupiter radii from Kanodia et al. 2023 (2023AJ....165..120K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..120K/abstract): 73,636.8 km at 71,492 km per Jupiter radius. GM from the mass 1.08 Jupiter masses (Kanodia et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....165..120K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....165..120K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kanodia et al. 2023 (2023AJ....165..120K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2023): P 1.630757 d Kanodia et al. 2023 (2023AJ....165..120K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2023): a/R* 10.94; Kanodia et al. 2023 (2023AJ....165..120K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2023): inclination 88.21 degrees Kanodia et al. 2023 (2023AJ....165..120K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2023): e 0.02 Kanodia et al. 2023 (2023AJ....165..120K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2023): omega -42 degrees, stored as 318 Kanodia et al. 2023 (2023AJ....165..120K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2023): transit mid-time 2459443.47179 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5205's measured colour (#ffca84, the colour dataset of toi-5205 (src/objects/toi-5205/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5205's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5205b.json).


## Known problems

- **Orbit convention.** omega -42 degrees is taken as Kanodia et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.02) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
