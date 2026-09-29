# TOI-5916 b

## Sources

It is the only planet known around TOI-5916. Its orbit and size follow O'Brien et al. 2026's fit, the archive's default. This account was drafted from O'Brien et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 1.05 Jupiter radii from O'Brien et al. 2026 (2026AJ....172..117O), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172..117O/abstract): 75,066.6 km at 71,492 km per Jupiter radius. GM from the mass 0.688 Jupiter masses (O'Brien et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026AJ....172..117O), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026AJ....172..117O/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Dransfield et al. 2026 (2026MNRAS.547ag448D), via the NASA Exoplanet Archive ps table (pl_refname DRANSFIELD_ET_AL_2026): P 2.367128 d O'Brien et al. 2026 (2026AJ....172..117O), via the NASA Exoplanet Archive ps table (pl_refname O_BRIEN_ET_AL_2026): a/R* 12.23; O'Brien et al. 2026 (2026AJ....172..117O), via the NASA Exoplanet Archive ps table (pl_refname O_BRIEN_ET_AL_2026): inclination 89.13 degrees O'Brien et al. 2026 (2026AJ....172..117O), via the NASA Exoplanet Archive ps table (pl_refname O_BRIEN_ET_AL_2026): e 0.045 O'Brien et al. 2026 (2026AJ....172..117O), via the NASA Exoplanet Archive ps table (pl_refname O_BRIEN_ET_AL_2026): omega -81 degrees, stored as 279 Dransfield et al. 2026 (2026MNRAS.547ag448D), via the NASA Exoplanet Archive ps table (pl_refname DRANSFIELD_ET_AL_2026): transit mid-time 2460255.6055 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5916's measured colour (#ffc88e, the colour lens of toi-5916 (src/objects/toi-5916/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5916's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5916b.json).


## Known problems

- **Orbit convention.** omega -81 degrees is taken as O'Brien et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.045) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
