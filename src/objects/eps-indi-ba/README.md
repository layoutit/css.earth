# Epsilon Indi Ba

Epsilon Indi Ba is a brown dwarf 1,460 au from Epsilon Indi A. With Bb, a second brown dwarf, it circles a common centre every 11 years. Its companion is [Bb](../eps-indi-bb/README.md).

## Sources

**Placement.** Gaia DR3 source 6412596012146801152: the light centre of the unresolved pair at epoch J2016.0, 402 arcseconds from Epsilon Indi A. Ba is placed there and Bb circles it; Ba really circles the pair's centre of mass at 0.443 of their separation (Chen et al. 2022), up to 1.1 au. The proper motion is Chen et al.'s for the centre of mass (3987.41, -2505.35 mas/yr), because Gaia's single-star solution absorbs the orbital motion (RUWE 4.3). The distance and radial velocity are Epsilon Indi A's: the pair's Gaia parallax is biased by the same orbit, Chen et al. measure 274.99 ± 0.43 mas in agreement with A's, and no radial velocity of the pair is measured ([record](../../../packages/astronomy/data/bodies/eps-indi-ba.json)).

**Mass, temperature and radius.** Mass 66.92 ± 0.36 Jupiter masses, measured from ten years of VLT orbit monitoring (Chen et al. [2022](https://arxiv.org/abs/2205.08077), Table 4). Temperature 1,312 ± 13 K from the SM08 hybrid evolutionary models at that mass and its luminosity (Chen et al. 2022). Radius 0.080 to 0.081 solar radii from COND03 models constrained by the dynamical system mass (King et al. [2010](https://arxiv.org/abs/0911.3143), A&A 510, A99); the lower bound is drawn. Model values, not a measured disc.

**Surface.** The shared neutral gray. King et al.'s resolved spectra start at 630 nm, and the missing blue part of the visible band, about two thirds of what the eye would see, would decide the colour, so no measured colour exists; a blackbody would misrepresent a brown dwarf's absorbed spectrum ([ledger](investigations.json)).

**Rotation.** No spin axis on the sky is measured; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version): [the four bodies in the app](../eps-indi-a/evidence/epsilon-indi.png), headless Chromium at 800 × 600 on this version, all in the one Epsilon Indi system. [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places Bb around Ba against Chen et al.'s NACO positions, and [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places both in the Epsilon Indi system.

## Known problems

- **Ba is drawn at the pair's light centre.** It is off by up to 1.1 au, less than half the pair's separation.
- **Borrowed distance and radial velocity.** Both are Epsilon Indi A's; the depth between A and B is not measured.
- **No surface.** The sphere is neutral gray.
- **The spin axis is a display convention.**

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
