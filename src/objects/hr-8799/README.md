# HR 8799

HR 8799 is a young F0 star 41 parsecs away in Pegasus. In 2008 it became the first star seen with several planets in direct images ([Marois et al. 2008](https://arxiv.org/abs/0811.2606)); a fourth followed in 2010 ([Marois et al. 2010](https://arxiv.org/abs/1011.4918)). Its planets are [b](../hr-8799-b/README.md), [c](../hr-8799-c/README.md), [d](../hr-8799-d/README.md) and [e](../hr-8799-e/README.md).

## Sources

**Placement.** Gaia DR3 source 2832463659640297472 (Gaia Collaboration 2023, A&A 674, A1): position at J2016.0, proper motion and radial velocity, and the parallax 24.4620 ± 0.0455 mas (RUWE 1.47), inverted to 40.8798 pc with no zero-point correction. The row was read from the Gaia archive on 2026-09-23 ([source record](../../sources/gaia-dr3-hr-8799.json)) and matches the astronomy record [`hr-8799.json`](../../../packages/astronomy/data/bodies/hr-8799.json) to the last digit. SIMBAD cross-identifies HD 218396 and HIP 114189 and gives the spectral type F0+VkA5mA5 (Gray et al. 2003): the hydrogen lines of an F0 star and the metal lines of an A5 star.

**Radius.** The CHARA Array's limb-darkened angular diameter, 0.342 ± 0.008 mas in the K band ([Baines et al. 2012](https://arxiv.org/abs/1210.0556), abstract), at the Gaia distance: 1,045,756 km, 1.503 solar radii. Baines et al. give 1.44 ± 0.06 solar radii from the same diameter at the parallax of their time. The record kept that value beside the Gaia distance until this version; the planets' orbits, which the records store in stellar radii, were rescaled with it, so their size in kilometres is unchanged.

**Mass and temperature.** 1.47 solar masses, the value Zurlo et al. ([2022](https://arxiv.org/abs/2207.10684)) adopt for the four-planet fit the orbits come from; Baines et al. derive 1.516 +0.038/−0.024 from evolutionary tracks. 7,193 ± 87 K from the CHARA diameter and the bolometric flux (Baines et al. 2012).

**Rotation.** None is adopted. Wright et al. (2011, ApJ 728, L20; [arXiv:1101.1590](https://arxiv.org/abs/1101.1590)) constrain the inclination of the star's axis from its γ Doradus pulsations, which is not a direction on the sky. The display axis is celestial north at the star ([rotation.json](source/preparation/rotation.json)).

**JWST picture of the system.** The star's gallery, shown on the HR 8799 system card, is our reduction of the raw JWST/NIRCam F410M frames of GTO programme 1194 (5 November 2023) with the [spaceKLIP toolkit](../../../tools/objects/jwst/klip/programs/hr-8799-1194.json), on the pipeline version, CRDS context and settings Balmer et al. ([2025](https://arxiv.org/abs/2503.13608)) state, with the reference star HD 220657 subtracting the starlight. It shows the KL 5 plane, the one the paper's Figure 4 shows, over that figure's field (±2.9″) and colour scale: the colour-bar image embedded in the figure's PDF (arXiv source `figures/imaging_summary`), decoded through its palette, runs from −10 to 48.4 MJy/sr, read from the bar's tick marks. North is up; each pixel is drawn as a square. The darkest patch at the centre is the star's masked core, which holds no value, and the bright spots just above and below d are the coronagraph's own diffraction, which the paper's figure shows too. In this band our planets stand 23, 15, 19 and 5 times above the scatter at their separation (b, c, d, e), against the paper's 18, 12, 31 and 10 (Table 2).

**Shape lens.** A sphere of that radius in the shared neutral gray. The star is 0.34 milliarcseconds across: CHARA measures its size, and no image of its surface exists.

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the four planets, at this star's Gaia distance, 4.8 to 14.4 mas from where JWST measured them on 5 November 2023 (Balmer et al. 2025, Table 2), astrometry that postdates the fit their orbits come from.
- The astronomy package's 855 tests pass with the corrected radius and rescaled orbits.
- The system card, captured headless from the dev server of this version: the JWST picture beside the prepared orbits, whose planets it shows in the same places ([hr-8799-system-card.png](evidence/hr-8799-system-card.png)).

## Known problems

- The shape lens is gray: no colour of the star is cast, though Gaia DR3 publishes its spectrum, as Beta Pictoris's colour uses.
- The mass is the one the orbit fit assumed, not a measurement of this package.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
