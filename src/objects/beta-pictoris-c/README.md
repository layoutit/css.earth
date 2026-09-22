# Beta Pictoris c

Beta Pictoris c is a giant planet 2.7 au from [Beta Pictoris](../beta-pictoris/README.md), found by radial velocity and confirmed directly with VLTI/GRAVITY in 2020.

## Sources

**Orbit.** Lacour et al. (2021, A&A 654, L2), Table 2, RV + b and c astrometry, orbitize! conventions: a 2.68 ± 0.02 au at their parallax (137.9 mas), 2.71 au at the Gaia DR3 distance; period 1221 ± 15 days; e 0.32 ± 0.02; i 88.95°; Ω 31.06°; ω 66.0° (the planet's, stored as the star's, 246.0°); periastron at MJD 59000 + 0.724 × 1221. At the four GRAVITY epochs of their Table 1 the recorded orbit lands within 0.9 mas RMS of the measured positions ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)).

**Radius and mass.** 1.2 ± 0.1 Jupiter radii, the radius the Exo-REM atmospheric model needs to give the flux-calibrated GRAVITY K-band spectrum at 1,250 K (Nowak et al. 2020); Drift-Phoenix gives 1.05 ± 0.1. Mass 8.89 ± 0.75 Jupiter masses, dynamical (Lacour et al. 2021).

**Rotation.** Not measured; the display axis is the orbit normal and nothing turns.

**Shape lens.** A sphere of the model radius in the shared neutral gray, self-luminous.

## Evidence

Run of 2026-09-22 (this version): `node tools/prepare/prepare-object.mts beta-pictoris-c` prepared the package through its world step; the orbit test above passes.

## Known problems

- The radius is a model value, and the two models disagree by 0.15 Jupiter radii.
- No rotation is measured.
- The planet orbits inside the part of the disc no image here reaches, so it is drawn in the disc's inner hole.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
