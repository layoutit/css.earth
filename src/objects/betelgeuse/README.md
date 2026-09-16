# Betelgeuse

## Sources

Betelgeuse is the first body here that is not in the Solar System and the first whose surface comes from an interferometer. It is placed at its catalogue position, 168 parsecs from the Sun, and shown as a sphere of the published radius carrying one image reconstructed from public VLT/MATISSE visibilities.

**Placement.** The ICRS position and proper motion are SIMBAD's, from the Hipparcos re-reduction of van Leeuwen (2007, A&A 474, 653); the radial velocity is Famaey et al. (2005, A&A 430, 165). The distance is Joyce et al. (2020, [ApJ 902, 63](https://arxiv.org/abs/2006.09837)): 168 (+27/−15) pc. Hipparcos alone gives 153 pc and Harper et al. (2017, AJ 154, 11) 222 pc from radio astrometry; the three disagree by 40 percent and the record in `packages/astronomy/data/bodies/betelgeuse.json` names all three. The scene position is the catalogue direction carried by the space velocity to the scene epoch, a displacement of one part in a million of the distance.

**Radius.** Joyce et al. (2020): 764 (+116/−62) solar radii, 531,514,800 km. The uniform-disc diameter fitted to the pinned visibilities in this package is 42.45 milliarcseconds, which at 168 pc is 767 solar radii, 0.4 percent larger; Drevon et al. (2024) report 43.8 mas for the same epoch. The reference surface is a sphere at the published radius, written by `tools/objects/source-authoring/betelgeuse/author.mts` as a 5-degree radius table. A red supergiant's photosphere has no sharp limb; the sphere is the surface the image is cast onto, not a measured shape.

**Rotation.** Kervella et al. (2018, [A&A 609, A67](https://arxiv.org/abs/1711.07983)) measure with ALMA a rotation-axis position angle of 48.0 ± 3.5 degrees east of north and a period P/sin i of 36 ± 8 years. The inclination is not measured there, so the pole is placed in the plane of the sky. Uitenbroek, Dupree & Gilliland (1998, AJ 116, 2501) instead argued from a Hubble bright spot that the pole points about 20 degrees from the line of sight; that alternative is recorded and not adopted. There is no measured prime meridian: the display meridian is set so that grid longitude 0 faces the Sun and Earth at the scene epoch, which puts the photographed hemisphere on the lit side.

**MATISSE photograph.** Drevon et al. (2024, [MNRAS Letters 527, L88](https://arxiv.org/abs/2401.12404)) imaged Betelgeuse with VLTI/MATISSE at three epochs. The calibrated February 2020 visibilities are public in the [JMMC OiDB](https://oidb.jmmc.fr/): 29 files from the nights of 8 February (stations A0-B2-D0-C1) and 19 February (K0-G2-D0-J3), pinned in `source/manifest.json` and restored by the acquisition plan. `author.mts` averages their beam-commuter repeats in the paper's pseudo-continuum windows (3.942–3.974 and 3.992–3.998 µm) into 780 squared visibilities and 520 closure phases with measured error floors, and writes them as one monochromatic OIFITS. The image was reconstructed from that file with the public [SQUEEZE](https://github.com/fabienbaron/squeeze) code at a pinned commit, with the paper's prior and hyperparameter (maximum entropy, µ = 10, uniform-disc start); the build and command are in `source/reference/squeeze-command.txt`. The paper's own code, IRBIS, is not public.

## Evidence

- `tests/objects/unit/betelgeuse/reconstruction.test.mts` recomputes the fit of the pinned image to the pinned visibilities with an independent discrete Fourier transform, without SQUEEZE: reduced chi-squared below 0.6 on squared visibilities and below 1.5 on closure phases (SQUEEZE reported 0.35 and 1.12), and a uniform disc of the same diameter fits the visibilities at least three times worse. When the 29 MATISSE files are acquired it also recomputes the merged OIFITS byte for byte.
- `tests/objects/unit/betelgeuse/camera.test.mts` recomputes every camera field of the lens from the astrometry, the pole and the image header through the same observer-camera transform the asteroid photographs use, and checks that the disc centre is the image's flux centroid and that the pole has the ALMA position angle.
- `tests/objects/unit/betelgeuse/source.test.mts` verifies every pin, that each input is downloaded or produced by a named tool, and that the sphere is the published radius on its grid.
- `packages/astronomy/src/stars.test.ts` checks the placement: distance, direction, proper motion and radial velocity round-trip.
- [`source/reference/reconstruction-comparison.png`](source/reference/reconstruction-comparison.png) places the published February 2020 image beside three SQUEEZE reconstructions of the pinned visibilities (entropy 10 and 1, total variation 1) convolved to the 4 mas beam; their peak-to-median contrast inside the disc is 1.30, 1.44 and 1.52.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/betelgeuse/` with the default camera: the photographed hemisphere faces the camera above the grid of the unobserved side.
- Preparation accepted 2,032 of 2,313 pixels with geometry; the 281 rejected lie beyond 70 degrees of incidence at the limb. No lit shape falls on sky.

## Known problems

**The image is a reconstruction.** An interferometer records no picture. The image is the maximum-entropy solution SQUEEZE prefers among those that fit the data; a different regulariser changes the fine structure. The interferometric beam is 4 milliarcseconds, five pixels, so nothing finer is resolved. Structure at the 30 percent level survives a hundredfold change of regulariser strength and a change of prior, in the retained pilot.

**Which side is brighter is weakly constrained.** Negating every closure phase gives an image that fits equally well (reduced chi-squared 1.30 against 1.28) and correlates best with the original rotated by 180 degrees. The lens therefore shows the reconstruction as made, and this caveat.

**One hemisphere, one band, one month.** The far hemisphere and the poles were not observed. Grayscale is relative intensity at 4 µm, not colour, temperature or albedo. The photosphere changes on a timescale of months; the December 2018 and December 2020 epochs are recorded as candidates, not shown.

**Silicon monoxide band not shipped.** The paper also images the SiO (2–0) band at 4.004–4.012 µm. The ESO pipeline flags every channel above 4.00 µm in these files, and reconstructions from the flagged channels do not fit their closure phases (reduced chi-squared above 23 at either sign and on a 100 mas field); squared visibilities alone fit at 1.2. Not shipped until that is understood.

**The sky is the Sun's.** The star field behind Betelgeuse is the shared cube baked from the Sun's position. From 168 parsecs the nearby stars would sit elsewhere; the cube is not the sky from Betelgeuse.

**Illumination is viewing.** The star is self-luminous. The pipeline's Sun direction is the direction to the Sun, which from Betelgeuse coincides with the direction to Earth within a thousandth of a degree, so incidence equals emission and the shading follows the viewing angle. Shadows default off and mean nothing here.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
