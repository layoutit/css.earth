# Betelgeuse

Betelgeuse is the first body here outside the Solar System and the first whose surface comes from an interferometer. It is placed at its catalogue position, 168 parsecs from the Sun, and shown as a sphere of the published radius carrying images reconstructed from public VLT/MATISSE visibilities. The dataset selector groups December 2018, February 2020 and December 2020 under one entry (see [dataset groups](../../../docs/reader-text.md#dataset-groups)).

## Sources

**Placement.** The ICRS position and proper motion are SIMBAD's, from the Hipparcos re-reduction of van Leeuwen (2007, A&A 474, 653); the radial velocity is Famaey et al. (2005, A&A 430, 165). The distance is Joyce et al. (2020, [ApJ 902, 63](https://arxiv.org/abs/2006.09837)): 168 (+27/−15) pc. Hipparcos alone gives 153 pc and Harper et al. (2017, AJ 154, 11) 222 pc from radio astrometry; `packages/astronomy/data/bodies/betelgeuse.json` names all three.

**Radius.** Joyce et al. (2020): 764 (+116/−62) solar radii. The uniform-disc diameter fitted to the pinned visibilities is 42.45 milliarcseconds; Drevon et al. (2024) report 43.8 mas for the same epoch. A red supergiant's photosphere has no sharp limb; the sphere is the surface the image is cast onto, not a measured shape.

**Rotation.** Kervella et al. (2018, [A&A 609, A67](https://arxiv.org/abs/1711.07983)) measure with ALMA a rotation-axis position angle of 48.0 ± 3.5 degrees east of north. The inclination is not measured, so the pole is placed in the plane of the sky. Uitenbroek, Dupree & Gilliland (1998, AJ 116, 2501) argued for a pole about 20 degrees from the line of sight; that alternative is recorded and not adopted.

**MATISSE images.** Drevon et al. (2024, [MNRAS Letters 527, L88](https://arxiv.org/abs/2401.12404)) imaged Betelgeuse with VLTI/MATISSE at three epochs. The calibrated visibilities are public in the [JMMC OiDB](https://oidb.jmmc.fr/): 29 files for February 2020, 111 for December 2018 and 48 for December 2020, pinned in `source/manifest.json`. `packages/bake/authoring/betelgeuse/author.mts` averages them in the paper's pseudo-continuum windows (3.942–3.974 and 3.992–3.998 µm). The images were reconstructed with the public [SQUEEZE](https://github.com/fabienbaron/squeeze) code with the paper's prior (maximum entropy, µ = 10, uniform-disc start); the command is in `source/reference/squeeze-command.txt`. The later epochs run through [image-star.mts](../../../packages/telescope-cli/src/archives/interferometry/image-star.mts) with the same recipe. Each dataset shows the image convolved to its interferometric beam (4 mas in February 2020), through the paper's heat palette from dark red to white.

**Color.** The color dataset comes from Betelgeuse's VLT/X-shooter spectrum of 12 October 2009, weighted by the CIE 1931 2° observer and converted to sRGB ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **#ffc876**. The citation is in [stellar-color.json](source/photometry/stellar-color.json), and [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the color. An independent scan by Kiehling (1987), HR 2061, gives #ffc36f.

**Limb.** The disc is dimmed by the quadratic law Neilson & Lester (2013), A&A 554, A98 compute from spherical ATLAS model atmospheres for the Johnson V band at 3,600 K and log g -0.08 (u1 1.114, u2 -0.025). The supergiant's gravity is below the Claret & Bloemen (2011) grid.

The [navigation marker](source/preparation/navigation.json) is a photosphere crop of the February 2020 reconstruction with a circular alpha edge. It omits off-limb emission.

## Evidence

- Recomputed with an independent Fourier transform, the February 2020 image fits the visibilities at reduced chi-squared below 0.6 on squared visibilities and below 1.5 on closure phases (SQUEEZE reported 0.35 and 1.12). A uniform disc fits at least three times worse.
- [`reconstruction-comparison.png`](source/reference/reconstruction-comparison.png) places the published image beside three SQUEEZE reconstructions; their peak-to-median contrast inside the disc is 1.30, 1.44 and 1.52.
- Preparation accepted 2,032 of 2,313 pixels; the rejected ones lie beyond 70 degrees of incidence. The accepted pixels cover 32.8 percent of the sphere.
- In Chrome at the default camera, the rendered disc correlates 0.83 with the reconstruction as seen on the sky against −0.28 with its mirror image. [`rendered-default-view.png`](source/reference/rendered-default-view.png) shows that view.

## Known problems

**The image is a reconstruction.** An interferometer records no picture. A different regulariser changes the fine structure, and nothing finer than the beam is shown.

**The halo is the same reconstruction.** A fifth of the image's flux lies outside the 42.45 mas disc. It is in the data: zeroing it raises the closure-phase reduced chi-squared from 1.2 to 890. The off-limb plate is a billboard behind the sphere, so away from the default camera the two part company.

**The patches are not confirmed.** Each image is checked against spotless twins reconstructed with the same recipe ([interferometric imaging guide](../../../docs/interferometric-imaging.md#measured-checks)). In February 2020, twins of 42.2 to 43.9 mas leave patch maps at 0.49 to 0.81 of the image's strength. December 2018 fits its closure phases at 3.03, over the limit of 3. December 2020's spots are no stronger than a spotless disc's. All three are shown with their patches labelled unconfirmed.

**Which side is brighter is weakly constrained.** Negating every closure phase gives an image that fits equally well.

**One hemisphere, one band.** The far hemisphere and the poles were not observed. The colors are a legend for relative intensity at 4 µm, not color, temperature or albedo.

**Silicon monoxide band not shipped.** Reconstructions from the flagged channels above 4.00 µm do not fit their closure phases.

**Other limits.** The color spectrum predates the Great Dimming and is not corrected for slit losses. The limb darkening is a model, not a measurement of this star. The background sky is the Sun's, not the sky from Betelgeuse. The star is self-luminous, so no lighting is applied.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
