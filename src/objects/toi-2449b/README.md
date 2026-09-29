# TOI-2449 b

## Sources

It is the only planet known around TOI-2449. Its orbit and size follow Ulmer-Moll et al. 2025's fit, the archive's default. This account was drafted from Ulmer-Moll et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 1.002 Jupiter radii from Ulmer-Moll et al. 2025 (2025A&A...703A.258U), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...703A.258U/abstract): 71,635 km at 71,492 km per Jupiter radius. GM from the mass 0.7 Jupiter masses (Ulmer-Moll et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...703A.258U), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...703A.258U/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 16.6542431 d Ulmer-Moll et al. 2025 (2025A&A...703A.258U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2025): a/R* derived from its semi-major axis 0.45 au and stellar radius 1.065 solar radii; Ulmer-Moll et al. 2025 (2025A&A...703A.258U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2025): inclination 89.55 degrees Ulmer-Moll et al. 2025 (2025A&A...703A.258U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2025): e 0.098 Ulmer-Moll et al. 2025 (2025A&A...703A.258U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2025): omega 266 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459186.901539 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2449's measured colour (#fff7fc, the colour lens of toi-2449 (src/objects/toi-2449/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2449's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2449b.json).


## Known problems

- **Orbit convention.** omega 266 degrees is taken as Ulmer-Moll et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.098) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
