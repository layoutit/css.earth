# TOI-5573 b

## Sources

It is the only planet known around TOI-5573. Its orbit and size follow Fernandes et al. 2025's fit, the archive's default. This account was drafted from Fernandes et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.87 Jupiter radii from Fernandes et al. 2025 (2025AJ....170...55F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170...55F/abstract): 62,198 km at 71,492 km per Jupiter radius. GM from the mass 0.35 Jupiter masses (Fernandes et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025AJ....170...55F), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025AJ....170...55F/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Fernandes et al. 2025 (2025AJ....170...55F), via the NASA Exoplanet Archive ps table (pl_refname FERNANDES_ET_AL_2025): P 8.79758977 d Fernandes et al. 2025 (2025AJ....170...55F), via the NASA Exoplanet Archive ps table (pl_refname FERNANDES_ET_AL_2025): a/R* 25.74; Fernandes et al. 2025 (2025AJ....170...55F), via the NASA Exoplanet Archive ps table (pl_refname FERNANDES_ET_AL_2025): inclination 89.01 degrees Fernandes et al. 2025 (2025AJ....170...55F), via the NASA Exoplanet Archive ps table (pl_refname FERNANDES_ET_AL_2025): e 0.072 Fernandes et al. 2025 (2025AJ....170...55F), via the NASA Exoplanet Archive ps table (pl_refname FERNANDES_ET_AL_2025): omega 32.8 degrees Fernandes et al. 2025 (2025AJ....170...55F), via the NASA Exoplanet Archive ps table (pl_refname FERNANDES_ET_AL_2025): transit mid-time 2459600.45078 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5573's measured colour (#ffc189, the colour lens of toi-5573 (src/objects/toi-5573/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5573's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (74), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5573b.json).


## Known problems

- **Orbit convention.** omega 32.8 degrees is taken as Fernandes et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.072) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
