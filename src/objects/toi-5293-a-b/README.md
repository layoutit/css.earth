# TOI-5293 A b

## Sources

It is the only planet known around TOI-5293 A. Its orbit and size follow Cañas et al. 2023's fit, the archive's default. This account was drafted from Cañas et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 1.06 Jupiter radii from Cañas et al. 2023 (2023AJ....166...30C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166...30C/abstract): 75,781.5 km at 71,492 km per Jupiter radius. GM from the mass 0.54 Jupiter masses (Cañas et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166...30C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166...30C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Cañas et al. 2023 (2023AJ....166...30C), via the NASA Exoplanet Archive ps table (pl_refname CA_NTILDE_AS_ET_AL__2023): P 2.930289 d Cañas et al. 2023 (2023AJ....166...30C), via the NASA Exoplanet Archive ps table (pl_refname CA_NTILDE_AS_ET_AL__2023): a/R* 14.1; Cañas et al. 2023 (2023AJ....166...30C), via the NASA Exoplanet Archive ps table (pl_refname CA_NTILDE_AS_ET_AL__2023): inclination 88.8 degrees Cañas et al. 2023 (2023AJ....166...30C), via the NASA Exoplanet Archive ps table (pl_refname CA_NTILDE_AS_ET_AL__2023): e 0.38 Cañas et al. 2023 (2023AJ....166...30C), via the NASA Exoplanet Archive ps table (pl_refname CA_NTILDE_AS_ET_AL__2023): omega -92 degrees, stored as 268 Cañas et al. 2023 (2023AJ....166...30C), via the NASA Exoplanet Archive ps table (pl_refname CA_NTILDE_AS_ET_AL__2023): transit mid-time 2459448.9148 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5293-a's measured colour (#ffc388, the colour lens of toi-5293-a (src/objects/toi-5293-a/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5293 A's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (70, 92), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5293-a-b.json).


## Known problems

- **Orbit convention.** omega -92 degrees is taken as Cañas et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.38) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
