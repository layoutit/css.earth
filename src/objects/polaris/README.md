# Polaris

## Sources

Polaris is the North Star, a supergiant Cepheid in Ursa Minor. Its package holds the placement, the published size and the record of what was tried for its surface. The public interferometry resolves its disc but not its surface, so no image of the photosphere is cast. A star with only its shape stays off the map until one can be: `discoveryVisibility` hides it and its label, and its page still opens from search. The [investigation ledger](investigations.json) records the attempts.

**Placement.** The ICRS position and proper motion are SIMBAD's, from the Hipparcos re-reduction of van Leeuwen (2007, A&A 474, 653). The radial velocity, −16.42 km/s, is the binary's systemic velocity in the SB9 catalogue (Pourbaix et al. 2004, A&A 424, 727). Polaris Aa is too bright for a reliable Gaia parallax. The distance is the 136.90 ± 0.34 pc Evans et al. (2024, [ApJ 971, 190](https://arxiv.org/abs/2407.09641)) adopt: the Gaia DR3 parallax of the wide companion Polaris B, corrected for the zero-point offset. The mass behind the display GM is the paper's dynamical mass of Polaris Aa, 5.13 ± 0.28 solar masses.

**Radius.** Evans et al. (2024) measure a mean limb-darkened diameter of 3.143 ± 0.027 mas with the CHARA Array's MIRC and MIRC-X combiners. At 136.90 pc that is 32,184,239 km, 46.26 solar radii. The reference surface is a sphere at that radius.

**Rotation: none measured.** No publication measures the rotation axis of Polaris. The rotation record is the `cssearth-display-orientation@1` convention used for the other stars without an axis: the display axis is celestial north at the star, in the plane of the sky, and the display meridian faces the Earth at the scene epoch.

**Colour dataset.** The colour of Polaris's HST/STIS spectrum, observed on 20 September 2001. Polaris pulsates slightly over four days, so this is one moment of that cycle. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#fff9fa**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 6015 K and log g 1.82: the edge is 31% as bright as the centre. That law is a model, not a measurement of this star. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colours from these inputs. Cross-check: Kharitonov et al. (1988), record 74, gives #fff7f7, 3 levels from the dataset colour in its most different channel (the threshold for agreement is 12).

## Evidence

[`investigations.json`](investigations.json) records the April 2021 image route and why it was excluded, the companion check and the published surface maps, with the measured numbers. The test that excluded the image, `packages/telescope-cli/src/archives/interferometry/spotless-disc.mts`, simulates a spotless limb-darkened disc on a file's own sampling and errors, and compares the spots of the two reconstructions:

| Star | Spot contrast ratio | Correlation with the spotless image |
|---|---|---|
| π¹ Gruis | 5.22 | 0.10 |
| Betelgeuse | 2.73 | 0.02 |
| Polaris, April 2021 | 1.05 | 0.57 |

[`source/reference/spotless-disc-comparison.png`](source/reference/spotless-disc-comparison.png) shows the Polaris maps side by side. [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) shows the default camera at `/polaris/`.

## Known problems

**No image of the surface.** The authors' merged CHARA/MIRC-X file of 2 to 4 April 2021 is public, and SQUEEZE fits it well. But the disc is about six interferometric beams across, and the same recipe run on a spotless disc sampled the same way draws the same dark spots east and west of centre, at the same contrast. What differs is a faint brightening to the north, the direction of the bright spot the paper reports, too weak to show as a surface. The paper's own SURFING and ROTIR maps carry the same warning and are not deposited as data. Reconstructing on a sphere with the public ROTIR code does no better: no fixed surface fits the closure phases better than reduced chi-squared 5.58, its spots are only 1.53 times a spotless disc's, and the two interleaved halves of the data give spots that barely agree (correlation 0.28). [Interferometric imaging](../../../docs/interferometric-imaging.md) describes both checks.

**The asymmetry is real.** A disc does not fit the closure phases (reduced chi-squared 18.9), and the faint companion Polaris Ab does not explain them: adding it makes the fit worse. The star is lopsided in some way this coverage cannot draw.

**The axis is a convention.** Where the pole really points is unknown.

**The sky is the Sun's.** The star field behind Polaris is the shared cube baked from the Sun's position.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
