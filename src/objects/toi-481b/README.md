# TOI-481 b

## Sources

It is the only planet known around TOI-481. Its orbit and size follow Brahm et al. 2020's fit, the archive's default. This account was drafted from Brahm et al. 2020's values; the sections below are the data's own.

**Size and mass.** Radius 0.99 Jupiter radii from Brahm et al. 2020 (2020AJ....160..235B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020AJ....160..235B/abstract): 70,777.1 km at 71,492 km per Jupiter radius. GM from the mass 1.53 Jupiter masses (Brahm et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020AJ....160..235B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020AJ....160..235B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 10.33116210622 d Brahm et al. 2020 (2020AJ....160..235B), via the NASA Exoplanet Archive ps table (pl_refname BRAHM_ET_AL__2020): a/R* derived from its semi-major axis 0.097 au and stellar radius 1.66 solar radii; Brahm et al. 2020 (2020AJ....160..235B), via the NASA Exoplanet Archive ps table (pl_refname BRAHM_ET_AL__2020): inclination 89.2 degrees Brahm et al. 2020 (2020AJ....160..235B), via the NASA Exoplanet Archive ps table (pl_refname BRAHM_ET_AL__2020): e 0.153 Brahm et al. 2020 (2020AJ....160..235B), via the NASA Exoplanet Archive ps table (pl_refname BRAHM_ET_AL__2020): omega 64.8 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460970.45735 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-481's measured colour (#fff1eb, the colour dataset of toi-481 (src/objects/toi-481/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-481's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (95, 96, 97), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-481b.json).


## Known problems

- **Orbit convention.** omega 64.8 degrees is taken as Brahm et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.153) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
