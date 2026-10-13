# GW Orionis

ALMA’s three dust rings are the default view of this triple star. The [disc package](../gw-orionis-disc/README.md) places its measured millimeter emission on the two planes its paper publishes, attached to the star through the existing volume bank.

## Sources

ALMA resolves three dust rings around the three stars of GW Orionis. The innermost ring is tilted out of the plane of the outer two. It is also HD 244138, HIP 25689. The introduction is generated from Kraus et al. (2020), Science 369, 1233's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3340856533286969600, distance 388 pc from Kraus et al. (2020), Table S3: adopted distance, 388 +/- 5 pc, the one the paper's ring radii in astronomical units assume; Gaia DR3's parallax, 2.451 ± 0.062 mas (39.3 standard errors), is not used. Radius 7.630508 solar radii from Model radius derived from Kraus et al. (2020), Table S3: L = 48 solar luminosities and T = 5500 K; R/Rsun = sqrt(48) (5772/5500)^2, using the IAU nominal solar temperature. The luminosity is the unresolved light of three stars, so this is the sphere that would give that light, not a measured stellar radius (https://doi.org/10.1126/science.aba4633). Mass 5.26 solar masses from Kraus et al. (2020), Table S5: total dynamical mass of the three stars, 5.26 +/- 0.22 solar masses, from their astrometric and radial-velocity orbits (https://doi.org/10.1126/science.aba4633). Temperature 5,500 K from Kraus et al. (2020), Table S3: adopted effective temperature. log g 3.39 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3340856533286969600, through the CIE 1931 2° observer: #ffddc3. Routes tried in order: stis-ngsl: HD 244138 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** No limb darkening is drawn: The sphere stands for the unresolved light of three stars. No resolved photosphere or applicable measured limb law is claimed..

## Evidence

Generated 2026-10-12 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Not shown.** The three stars are drawn as one sphere: they lie 1.2 and 8.9 astronomical units apart, and their orbits are not drawn.
- **Not shown.** The disc's millimeter emission is observed; its third dimension is a reconstruction on the published ring planes.
- **Not shown.** The warped surface the paper models between the middle and inner rings from scattered light is not drawn.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
