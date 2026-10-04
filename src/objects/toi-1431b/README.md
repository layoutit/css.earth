# TOI-1431 b

## Sources

It is the only planet known around TOI-1431. Its orbit and size follow Addison et al. 2021's fit, the archive's default. The introduction is generated from Addison et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 1.49 Jupiter radii from Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..292A/abstract): 106,523.1 km at 71,492 km per Jupiter radius. GM from the mass 3.12 Jupiter masses (Addison et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....162..292A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....162..292A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 2.650232 d Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): a/R* 5.15; Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): inclination 80.13 degrees Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): e 0.0022 Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): omega 108 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460554.58625 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at the 2,370 K equilibrium temperature of Addison et al. 2021, equilibrium temperature (NASA Exoplanet Archive planetary systems table): #ff9e3f. Chosen by rule: 1 paper in the archive prints one; the archive's default parameter set. On 120 hot Jupiters whose day side Spitzer measured, the measured temperature is within 20% of this kind of estimate for 83% (Deming et al. 2023); see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of TOI-1431's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (77, 83, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1431b.json).

## Known problems

- **Orbit convention.** omega 108 degrees is taken as Addison et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0022) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1431 b" (revision 1366872522) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
