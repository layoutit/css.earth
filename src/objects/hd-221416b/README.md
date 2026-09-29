# HD 221416 b

## Sources

It is the only planet known around HD 221416. Its orbit and size follow Huber et al. 2019's fit, the archive's default. This account was drafted from Huber et al. 2019's values; the sections below are the data's own.

**Size and mass.** Radius 0.836 Jupiter radii from Huber et al. 2019 (2019AJ....157..245H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157..245H/abstract): 59,767.3 km at 71,492 km per Jupiter radius. GM from the mass 0.19 Jupiter masses (Huber et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019AJ....157..245H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019AJ....157..245H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 14.28117312608 d Huber et al. 2019 (2019AJ....157..245H), via the NASA Exoplanet Archive ps table (pl_refname HUBER_ET_AL__2019): a/R* 8.97; Huber et al. 2019 (2019AJ....157..245H), via the NASA Exoplanet Archive ps table (pl_refname HUBER_ET_AL__2019): inclination 85.75 degrees Huber et al. 2019 (2019AJ....157..245H), via the NASA Exoplanet Archive ps table (pl_refname HUBER_ET_AL__2019): e 0.115 Huber et al. 2019 (2019AJ....157..245H), via the NASA Exoplanet Archive ps table (pl_refname HUBER_ET_AL__2019): omega -106 degrees, stored as 254 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460927.616153 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-221416's measured colour (#ffe7d3, the colour lens of hd-221416 (src/objects/hd-221416/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 221416's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (2, 29, 96), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-221416b.json).


## Known problems

- **Orbit convention.** omega -106 degrees is taken as Huber et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.115) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "HD 221416 b" (revision 1374392430), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
