# HL Tauri

ALMA’s nested dust rings are the default view of this young star. The [disc package](../hl-tauri-disc/README.md) turns its measured millimeter emission into a thin 3D reconstruction, attached to the star through the existing volume bank. The shared camera can turn the disc from its observed inclination to face-on and edge-on.

## Sources

- **Position:** [ALMA Partnership et al. (2015), ApJL 808, L3](https://doi.org/10.1088/2041-8205/808/1/L3), Table 1 and Section 3.1.1. The Band 6 continuum peak is at 04:31:38.42548, +18:13:57.242, ICRS/J2000 at epoch 2014.83. The radio proper motion is +18.5 and −22.3 mas per year, with the right-ascension component including cos(declination). The package uses this radio position and motion; it does not substitute an optical photocenter.
- **Stellar model:** [Pinte et al. (2016), ApJ 816, 25](https://doi.org/10.3847/0004-637X/816/1/25), Sections 1, 3.1 and 5. The adopted distance is 140 pc, temperature 4000 K, luminosity 11 solar luminosities, and central mass 1.7 solar masses inferred from gas kinematics. The reference sphere’s radius is calculated from that luminosity and temperature: `sqrt(11) × (5772/4000)² = 6.91` solar radii. It is a model radius, not a resolved measurement.
- **Color:** a Planck spectrum at the model’s 4000 K, integrated through the shared CIE 1931 observer. The stellar photosphere is not imaged. The observed disc has its own false-color brightness display, described in its README.

The [star spec](../../../packages/telescope-cli/authoring/hl-tauri/stars.json) records the cited inputs; the [astronomy record](../../../packages/astronomy/data/bodies/hl-tauri.json) places the star. Object-owned dataset declarations attach the disc as `dust-rings` and select it by default. No renderer, camera, navigation-policy or shell implementation is added.

## Evidence

- The radio position and proper motion retain epoch 2014.83 through the star generator. The regression checks also preserve the existing J2000 behavior for printed positions without motion.
- The native ALMA image’s brightest pixel is 6.483 mJy per beam, agreeing with the paper’s 6.48 ± 0.03 mJy per beam. The propagated stellar position lies 0.46 native pixels from that brightest pixel; the image has 5 mas pixels.
- The disc README records its plane, depth assumptions, source projection, color calibration and rendered evidence.

## Known problems

The star’s radius, temperature and color are an unresolved stellar model. Its spin axis and rotation phase are display conventions. No heliocentric radial velocity is adopted; zero is used for display propagation, rather than treating the paper’s LSR gas velocities as stellar radial velocity.

The millimeter image measures dust emission. Disc depth is modeled, and the gaps do not establish planet positions. No planets are placed in them.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Disc sources and evidence](../hl-tauri-disc/README.md) · [Credits](NOTICE.md)
