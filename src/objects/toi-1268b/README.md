# TOI-1268 b

## Sources

It is the only planet known around TOI-1268. Its orbit and size follow &Scaron;ubjak et al. 2022's fit, the archive's default. This account was drafted from &Scaron;ubjak et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.81184902 Jupiter radii from &Scaron;ubjak et al. 2022 (2022A&A...662A.107S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...662A.107S/abstract): 58,040.7 km at 71,492 km per Jupiter radius. GM from the mass 0.30330832 Jupiter masses (&Scaron;ubjak et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022A&A...662A.107S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022A&A...662A.107S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 8.157721 d &Scaron;ubjak et al. 2022 (2022A&A...662A.107S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2022): a/R* 16.62; &Scaron;ubjak et al. 2022 (2022A&A...662A.107S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2022): inclination 88.63 degrees &Scaron;ubjak et al. 2022 (2022A&A...662A.107S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2022): e 0.105 &Scaron;ubjak et al. 2022 (2022A&A...662A.107S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2022): omega -40.6 degrees, stored as 319.4 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460359.607231 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1268's measured colour (#ffe4d3, the colour dataset of toi-1268 (src/objects/toi-1268/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1268's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (49, 75, 76), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1268b.json).


## Known problems

- **Orbit convention.** omega -40.6 degrees is taken as &Scaron;ubjak et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.105) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
