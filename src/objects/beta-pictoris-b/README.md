# Beta Pictoris b

Beta Pictoris b is a super-Jupiter about 10 au from [Beta Pictoris](../beta-pictoris/README.md), imaged directly since 2008. In 2025 and 2026 MeerKAT heard auroral radio bursts from it, the first radio emission localised to an exoplanet.

## Sources

**Orbit.** Lacour et al. (2021, A&A 654, L2, [arXiv:2109.10671](https://arxiv.org/abs/2109.10671)), Table 2, the fit to GRAVITY astrometry of b and c and HARPS radial velocities, in the orbitize! conventions of Blunt et al. (2020): a 9.93 ± 0.03 au at their parallax 51.44 mas (510.8 mas), placed at the Gaia DR3 distance as 10.03 au; e 0.103 ± 0.003; i 89.00°; Ω 31.79°; ω 199.3° (the planet's, stored as the star's, 19.3°); τ 0.719, the fraction of a period after MJD 59000 at which periastron falls. The paper prints no period for b; it is derived from Kepler's third law with their masses (star 1.75, b 11.90, c 8.89 Jupiter masses): 23.52 years. The hosted-orbit contract gained a periastron epoch for this, since a directly imaged orbit publishes periastron rather than transit.

**Checked against the paper's own astrometry.** At the seven GRAVITY epochs of Lacour et al. (Table 1) the recorded orbit lands within 1.3 mas RMS of the measured positions, 68 to 398 mas from the star; the other three sign choices of Ω and ω miss by 661 mas ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)).

**Radius and mass.** 1.45 ± 0.02 Jupiter radii from hot-start evolutionary tracks at the measured bolometric luminosity (Morzinski et al. 2015): a model radius, the planet is unresolved. Mass 11.90 +2.93/−3.04 Jupiter masses, dynamical (Lacour et al. 2021).

**Rotation.** A 9.00 ± 0.13 hour period from JWST/NIRCam photometry of the planet over 16.2 hours in F210M and F410M (Zhou et al. 2026, [arXiv:2607.13133](https://arxiv.org/abs/2607.13133), programme 4758): the sphere turns at 960° per day about its orbit normal. Zhou et al. find the spin axis near equator-on with no sign of misalignment from the orbit; the axis's direction on the sky and the spin sense are not measured, and the prime meridian is arbitrary.

**Radio.** Ortiz Ceballos, Berger and Cendes (2026, [arXiv:2609.16720](https://arxiv.org/abs/2609.16720)): rapid, recurring bursts 40–70% circularly polarised, and persistent emission, at 0.856 to 3.5 GHz over four MeerKAT epochs (15 February and 31 May 2025, 20 February and 2 May 2026); brightest burst 307 µJy, quiescent S-band 48 µJy. The source coincides with planet b against nine Gaia quasars and a VLBI calibrator and is 4.4σ from the star. As electron cyclotron maser emission, the highest frequency implies a field of at least 1.25 kG. The radio source is unresolved: these are facts in the panel, not a picture on the sphere.

**Shape lens.** A sphere of the model radius in the shared neutral gray, self-luminous (1,742 K, GRAVITY Collaboration 2020): no image or visible colour of the planet exists.

## Evidence

Run of 2026-09-22 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) reproduces the GRAVITY astrometry of b and c and the discovery astrometry of d (above).
- `node tools/prepare/prepare-object.mts beta-pictoris-b` prepared the package through its world step.
- The JWST disc lens places the star by this orbit: planet b is found 79 and 93 mas from where the mosaics' pointing predicts, and the orbit, not the pointing, is trusted ([disc README](../beta-pictoris-disc/README.md)).
- Dev server `/beta-pictoris-b/` renders the sphere and its reader text with no console errors.

## Known problems

- The radius is a model value; no disc of the planet is measured.
- The period is derived, not printed by the paper; its uncertainty follows the masses.
- The spin axis is taken on the orbit normal; its direction on the sky is not measured.
- Orbit elements are posterior medians, which reproduce the data but are not a single self-consistent sample.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
