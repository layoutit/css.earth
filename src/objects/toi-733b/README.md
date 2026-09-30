# TOI-733 b

## Sources

It is the only planet known around TOI-733. Its orbit and size follow Georgieva et al. 2023's fit, the archive's default. This account was drafted from Georgieva et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.17771464 Jupiter radii from Georgieva et al. 2023 (2023A&A...674A.117G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A.117G/abstract): 12,705.2 km at 71,492 km per Jupiter radius. GM from the mass 0.01799713 Jupiter masses (Georgieva et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...674A.117G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...674A.117G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.8847937 d Georgieva et al. 2023 (2023A&A...674A.117G), via the NASA Exoplanet Archive ps table (pl_refname GEORGIEVA_ET_AL_2023): a/R* 14; Georgieva et al. 2023 (2023A&A...674A.117G), via the NASA Exoplanet Archive ps table (pl_refname GEORGIEVA_ET_AL_2023): inclination 88.85 degrees Georgieva et al. 2023 (2023A&A...674A.117G), via the NASA Exoplanet Archive ps table (pl_refname GEORGIEVA_ET_AL_2023): e 0.046 Georgieva et al. 2023 (2023A&A...674A.117G), via the NASA Exoplanet Archive ps table (pl_refname GEORGIEVA_ET_AL_2023): omega -53.2 degrees, stored as 306.8 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460030.757093 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-733's measured colour (#fff2ef, the colour dataset of toi-733 (src/objects/toi-733/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-733's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (90, 99, 100), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-733b.json).


## Known problems

- **Orbit convention.** omega -53.2 degrees is taken as Georgieva et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.046) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
