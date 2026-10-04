# Betelgeuse

Betelgeuse is the first body here outside the Solar System and the first whose surface comes from an interferometer. It is placed at its catalogue position, 168 parsecs from the Sun, and shown as a sphere of the published radius carrying images reconstructed from public VLT/MATISSE visibilities. The dataset selector groups December 2018, February 2020 and December 2020 under one entry (see [dataset groups](../../../docs/reader-text.md#dataset-groups)). Its companion, Siwarha, is drawn as a point on its orbit, and the material around the star is in [the circumstellar volumes](../betelgeuse-shell/README.md).

## Sources

**Placement.** The ICRS position and proper motion are SIMBAD's, from the Hipparcos re-reduction of van Leeuwen (2007, A&A 474, 653); the radial velocity is Famaey et al. (2005, A&A 430, 165). The distance is Joyce et al. (2020, [ApJ 902, 63](https://arxiv.org/abs/2006.09837)): 168 (+27/−15) pc. Hipparcos alone gives 153 pc and Harper et al. (2017, AJ 154, 11) 222 pc from radio astrometry; `packages/astronomy/data/bodies/betelgeuse.json` names all three.

**Radius.** Joyce et al. (2020): 764 (+116/−62) solar radii. The uniform-disc diameter fitted to the pinned visibilities is 42.45 milliarcseconds; Drevon et al. (2024) report 43.8 mas for the same epoch. A red supergiant's photosphere has no sharp limb; the sphere is the surface the image is cast onto, not a measured shape.

**Rotation.** Kervella et al. (2018, [A&A 609, A67](https://arxiv.org/abs/1711.07983)) measure with ALMA a rotation-axis position angle of 48.0 ± 3.5 degrees east of north. The inclination is not measured, so the pole is placed in the plane of the sky. Uitenbroek, Dupree & Gilliland (1998, AJ 116, 2501) argued for a pole about 20 degrees from the line of sight; that alternative is recorded and not adopted.

**MATISSE images.** Drevon et al. (2024, [MNRAS Letters 527, L88](https://arxiv.org/abs/2401.12404)) imaged Betelgeuse with VLTI/MATISSE at three epochs. The calibrated visibilities are public in the [JMMC OiDB](https://oidb.jmmc.fr/): 29 files for February 2020, 111 for December 2018 and 48 for December 2020, pinned in `source/manifest.json`. `packages/bake/authoring/betelgeuse/author.mts` averages them in the paper's pseudo-continuum windows (3.942–3.974 and 3.992–3.998 µm). The images were reconstructed with the public [SQUEEZE](https://github.com/fabienbaron/squeeze) code with the paper's prior (maximum entropy, µ = 10, uniform-disc start); the command is in `source/reference/squeeze-command.txt`. The later epochs run through [image-star.mts](../../../packages/telescope-cli/src/archives/interferometry/image-star.mts) with the same recipe. Each dataset shows the image convolved to its interferometric beam (4 mas in February 2020), through the paper's heat palette from dark red to white. The image is cast onto the sphere out to 88 degrees from the disc centre, so the drawn disc ends at the star's own outline.

**Colour.** The colour dataset comes from Betelgeuse's VLT/X-shooter spectrum of 12 October 2009, weighted by the CIE 1931 2° observer and converted to sRGB ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffc876**. The citation is in [stellar-color.json](source/photometry/stellar-color.json), and [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colour. An independent scan by Kiehling (1987), HR 2061, gives #ffc36f.

**Limb.** The colour dataset's disc is dimmed by the quadratic law Neilson & Lester (2013), A&A 554, A98 compute from spherical ATLAS model atmospheres for the Johnson V band at 3,600 K and log g -0.08 (u1 1.114, u2 -0.025). The supergiant's gravity is below the Claret & Bloemen (2011) grid.

**Companion.** Siwarha (Alpha Orionis B; the IAU adopted the name on 22 September 2025) is an astronomy record with no package of its own, [`siwarha.json`](../../../packages/astronomy/data/bodies/siwarha.json), drawn as a point on its orbit:

| What | Value | Printed in |
|---|---|---|
| Period | 2109.2 (+9.2/−9.1) days | MacLeod et al. (2025, [ApJ 978, 50](https://arxiv.org/abs/2409.11332)), Table 1, radial velocities of 1896 to 2024 |
| Size of the orbit | 1818 ± 6 solar radii, 2.38 stellar radii | the same paper, for a Betelgeuse of 17.5 solar masses |
| In front of the star | JD 2459984 (2023.12 +0.34/−0.35) | the same paper, equation 3 |
| Inclination | 98 ± 5 degrees | the same paper, Table 4 |
| Where it was seen | 52.32 ± 0.18 mas at position angle 117.12 ± 0.60 degrees, 6 December 2024 | Montargès et al. (2026, [A&A 711, L12](https://doi.org/10.1051/0004-6361/202661023)), VLT/SPHERE, 6.1 sigma |

The orbit is a circle, as the radial-velocity fit assumes. Its direction on the sky is set by where SPHERE saw the companion, a quarter of a period after the 2023 transit; the astrometric fit of MacLeod et al. gives 60 ± 6 degrees, which does not pass through that position and is not used. The telescope-images picture in the sidebar is the signal-to-noise map ESO published with the detection (`Betelgeuse_B_PACO_2024-12-06_CntHa.fits`, collection [BETELGEUSE-B](https://archive.eso.org/scienceportal/home?data_collection=BETELGEUSE-B)), drawn pixel for pixel by [fits-gallery-image.ts](../../../packages/bake/src/objects/charts/fits-gallery-image.ts).

The [navigation marker](source/preparation/navigation.json) is a photosphere crop of the February 2020 reconstruction with a circular alpha edge. It omits off-limb emission.

## Evidence

- Recomputed with an independent Fourier transform, the February 2020 image fits the visibilities at reduced chi-squared below 0.6 on squared visibilities and below 1.5 on closure phases (SQUEEZE reported 0.35 and 1.12). A uniform disc fits at least three times worse.
- [`reconstruction-comparison.png`](source/reference/reconstruction-comparison.png) places the published image beside three SQUEEZE reconstructions; their peak-to-median contrast inside the disc is 1.30, 1.44 and 1.52.
- Each image is cast out to 88 degrees from the disc centre and covers 48.5 percent of the sphere; a whole hemisphere is 50. A point near the limb takes the image's value at its own place on the sky ([`footprint.test.mts`](../../../packages/bake/src/objects/layers/terrestrial/surface-observations/footprint.test.mts)).
- The recorded orbit puts Siwarha 46.1 mas from the star at position angle 113.6 degrees on the night SPHERE found it at 52.32 mas and 117.12 degrees: 6 mas inside, within what the transit time's uncertainty of about 128 days allows. It crosses the disc at the 2023 transit and passes behind the star half a period later ([`hostedOrbits.binaries.test.ts`](../../../packages/astronomy/src/hostedOrbits.binaries.test.ts)).
- The detection map peaks at 6.11 at pixel (59, 65), 46 to 50 mas east-southeast of the centre of its footprint depending on the centre's pixel.
- [`rendered-default-view.png`](source/reference/rendered-default-view.png) shows the default view of September 2026, before the image reached the limb: in Chrome the rendered disc correlated 0.83 with the reconstruction as seen on the sky against −0.28 with its mirror image.

## Known problems

**The image is a reconstruction.** An interferometer records no picture. A different regulariser changes the fine structure, and nothing finer than the beam is shown.

**The first beam outside the disc is not drawn.** Between 1.00 and 1.19 stellar radii each image holds 7.5 to 9.8 percent of its light, measured about its centroid: the star's own edge smeared by the beam. The sphere ends at the disc and the [off-limb volume](../betelgeuse-shell/README.md) starts one beam out, so in February 2020 a dark gap separates them that the image does not have. Drawing that light on the off-limb volume's scale, which tops out at 6 percent of the central brightness, turns it into a flat saturated band; the two scales cannot meet.

**Only February 2020 has light beyond the first beam.** It carries 10.3 percent of its flux outside 1.19 stellar radii; December 2018 and December 2020 carry 0.6 and 0.9 percent, so they have no off-limb volume. The February light is in the data: zeroing everything outside the disc raises the closure-phase reduced chi-squared from 1.2 to 890.

**The patches are not confirmed.** Each image is checked against spotless twins reconstructed with the same recipe ([interferometric imaging guide](../../../docs/interferometric-imaging.md#measured-checks)). In February 2020, twins of 42.2 to 43.9 mas leave patch maps at 0.49 to 0.81 of the image's strength. December 2018 fits its closure phases at 3.03, over the limit of 3. December 2020's spots are no stronger than a spotless disc's. All three are shown with their patches labelled unconfirmed.

**Which side is brighter is weakly constrained.** Negating every closure phase gives an image that fits equally well.

**One hemisphere, one band.** The far hemisphere was not observed, and near the limb each image pixel is stretched over a long strip of the sphere. The colours are a legend for relative intensity at 4 µm, not colour, temperature or albedo.

**The companion is a candidate, and a point.** One epoch has seen it; that it is bound to Betelgeuse awaits a second. No paper measures its size or temperature, and its mass is disputed: 0.60 ± 0.14 solar masses at least from the radial velocities, 2.6 to 3.1 if the detected light is a coeval star's (Montargès et al. 2026), under 1.5 from the far ultraviolet (Goldberg et al. 2025, [arXiv 2505.18375](https://arxiv.org/abs/2505.18375)), and possibly Betelgeuse's own light reflected where the companion ploughs through its dust (Goldberg et al. 2026, [arXiv 2608.11672](https://arxiv.org/abs/2608.11672)). So it is drawn as a point, not a sphere, and the orbit's eccentricity is the fit's assumption.

**Silicon monoxide band not shipped.** Reconstructions from the flagged channels above 4.00 µm do not fit their closure phases.

**Other limits.** The colour spectrum predates the Great Dimming and is not corrected for slit losses. The limb darkening is a model, not a measurement of this star. The star is self-luminous, so no lighting is applied.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
