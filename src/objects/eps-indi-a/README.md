# Epsilon Indi A

Epsilon Indi A is one of the nearest Sun-like stars, 3.6 parsecs away. JWST has imaged its planet Ab, and a pair of brown dwarfs circles it 1,460 au out.

## Sources

**Placement.** Gaia DR3 source 6412595290592307840 (Gaia Collaboration 2023): position at J2016.0, proper motion and parallax ([source record](../../sources/gaia-dr3-eps-indi-a.json)).

**Radius, temperature and mass.** A measured radius: 0.713 ± 0.006 solar radii from interferometry, 4,700 ± 65 K and 0.782 ± 0.023 solar masses, as Sanghi et al. ([2026](https://arxiv.org/abs/2603.08787)) tabulate them (Table 1). The mass is asteroseismic: Lundkvist et al. ([2024](https://arxiv.org/abs/2403.04509)) detected the star's solar-like oscillations, the coolest dwarf yet, and scaled their frequency with the known radius.

**Its companions.** The planet [Ab](../eps-indi-ab/README.md) circles it about 16 au out, and the brown dwarfs [Ba](../eps-indi-ba/README.md) and [Bb](../eps-indi-bb/README.md) circle each other 1,460 au away.

**Radial velocity.** Gaia DR3's -40.43 ± 0.13 km/s. Also HD 209100 and HIP 108870.

**Color dataset.** The color of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)). **Rotation.** No axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,700 K and log g 4.63 (u1 0.736, u2 0.053): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/eps-indi-a.json: 4.625.

## Evidence

Run of 2026-09-23 (this version): the four bodies in the app, headless Chromium at 800 × 600 on this version, all in the one Epsilon Indi system. see the planet's README for its placement against the measured positions.

## Known problems

- The radius is a model or catalogue value; the disc is not measured.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.
[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
