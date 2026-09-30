# Kepler-411 c

## Sources

It is one of 4 planets known around Kepler-411. Its orbit and size follow Sun et al. 2019's fit, the archive's default. The introduction is generated from Sun et al. 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 0.3944152 Jupiter radii from Sun et al. 2019 (2019A&A...624A..15S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019A&A...624A..15S/abstract): 28,197.5 km at 71,492 km per Jupiter radius. GM from the mass 0.08306327 Jupiter masses (Sun et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019A&A...624A..15S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019A&A...624A..15S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): P 7.83443074 d Sun et al. 2019 (2019A&A...624A..15S), via the NASA Exoplanet Archive ps table (pl_refname SUN_ET_AL__2019): a/R* derived from its semi-major axis 0.0739 au and stellar radius 0.82 solar radii; Sun et al. 2019 (2019A&A...624A..15S), via the NASA Exoplanet Archive ps table (pl_refname SUN_ET_AL__2019): inclination 88.61 degrees Sun et al. 2019 (2019A&A...624A..15S), via the NASA Exoplanet Archive ps table (pl_refname SUN_ET_AL__2019): e 0.108 Sun et al. 2019 (2019A&A...624A..15S), via the NASA Exoplanet Archive ps table (pl_refname SUN_ET_AL__2019): omega 103 degrees Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): transit mid-time 2454960.387693 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by kepler-411's measured colour (#ffd7bc, the colour dataset of kepler-411 (src/objects/kepler-411/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Kepler-411's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (80, 81, 82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-411c.json).

## Known problems

- **Orbit convention.** omega 103 degrees is taken as Sun et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.108) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
