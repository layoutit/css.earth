# Beta Pictoris b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

Beta Pictoris b is a super-Jupiter about 10 au from [Beta Pictoris](../beta-pictoris/README.md), imaged directly since 2008. In 2025 and 2026 MeerKAT heard auroral radio bursts from it, the first radio emission localised to an exoplanet.

## Sources

**Orbit.** Lacour et al. (2021, A&A 654, L2, [arXiv:2109.10671](https://arxiv.org/abs/2109.10671)), Table 2, the fit to GRAVITY astrometry of b and c and HARPS radial velocities, in the orbitize! conventions of Blunt et al. (2020): a 9.93 ± 0.03 au at their parallax 51.44 mas (510.8 mas), placed at the Gaia DR3 distance as 10.03 au; e 0.103 ± 0.003; i 89.00°; Ω 31.79°; ω 199.3° (the planet's, stored as the star's, 19.3°); τ 0.719, the fraction of a period after MJD 59000 at which periastron falls. The paper prints no period for b; it is derived from Kepler's third law with their masses (star 1.75, b 11.90, c 8.89 Jupiter masses): 23.52 years. The hosted-orbit contract gained a periastron epoch for this, since a directly imaged orbit publishes periastron rather than transit.

**Checked against the paper's own astrometry.** At the seven GRAVITY epochs of Lacour et al. (Table 1) the recorded orbit lands within 1.3 mas RMS of the measured positions, 68 to 398 mas from the star; the other three sign choices of Ω and ω miss by 661 mas ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)).

**Radius and mass.** 1.45 ± 0.02 Jupiter radii from hot-start evolutionary tracks at the measured bolometric luminosity (Morzinski et al. 2015): a model radius, the planet is unresolved. Mass 11.90 +2.93/−3.04 Jupiter masses, dynamical (Lacour et al. 2021).

**Its own light.** The planet is drawn self-luminous (1,742 K, GRAVITY Collaboration 2020): its glow is its own heat.

**Infrared color dataset.** The default dataset paints the sphere one false color from its measured flux in three infrared bands: red MKO K 2.184 µm (6807 ± 440 µJy), green MKO H 1.614 µm (4953 ± 500 µJy), blue MKO J 1.2417 µm (3738 ± 720 µJy) (Males et al. (2014), as compiled in Best, Liu, Magnier & Dupuy (2024), The UltracoolSheet v2.1 (Zenodo); zero points from the SVO Filter Profile Service; [record](source/photometry/band-color.json)). Display range: this planet alone, from zero to its brightest band (MKO K), so the color shows its band ratios; brightness is not compared across planets at different distances. Not a natural color; nobody has resolved its disc.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret, Hauschildt & Witte (2012), A&A 546, A14 compute from PHOENIX model atmospheres for the H band at 1,742 K and log g 4.15 (u1 0.803, u2 -0.050): a model, not a measurement of this planet ([nodes](source/photometry/claret-2012-h-quadratic.tsv)). Its temperature is the 1,742 K of its measurements record; log g 4.15 follows from the mass and radius of its astronomy record (packages/astronomy/data/bodies/beta-pictoris-b.json).

**Rotation.** A 9.00 ± 0.13 hour period from JWST/NIRCam photometry of the planet over 16.2 hours in F210M and F410M (Zhou et al. 2026, [arXiv:2607.13133](https://arxiv.org/abs/2607.13133), programme 4758): the sphere turns at 960° per day about its orbit normal. Zhou et al. find the spin axis near equator-on with no sign of misalignment from the orbit; the axis's direction on the sky and the spin sense are not measured, and the prime meridian is arbitrary.

**Radio.** Ortiz Ceballos, Berger and Cendes (2026, [arXiv:2609.16720](https://arxiv.org/abs/2609.16720)): rapid, recurring bursts 40–70% circularly polarised, and persistent emission, at 0.856 to 3.5 GHz over four MeerKAT epochs (15 February and 31 May 2025, 20 February and 2 May 2026); brightest burst 307 µJy, quiescent S-band 48 µJy. The source coincides with planet b against nine Gaia quasars and a VLBI calibrator and is 4.4σ from the star. As electron cyclotron maser emission, the highest frequency implies a field of at least 1.25 kG. The radio source is unresolved: these are facts in the panel, not a picture on the sphere.

## Evidence

Run of 2026-09-22 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) reproduces the GRAVITY astrometry of b and c and the discovery astrometry of d (above).
- [`node packages/bake/src/prepare-object/index.ts beta-pictoris-b`](../../../packages/bake/cli/prepare-object.mts) prepared the package through its world step.
- The JWST disc dataset places the star by this orbit: planet b is found 79 and 93 mas from where the mosaics' pointing predicts, and the orbit, not the pointing, is trusted ([disc README](../beta-pictoris-disc/README.md)).
- Dev server `/beta-pictoris-b/` renders the sphere and its reader text with no console errors.

## Known problems

- The radius is a model value; no disc of the planet is measured.
- The period is derived, not printed by the paper; its uncertainty follows the masses.
- The spin axis is taken on the orbit normal; its direction on the sky is not measured.
- Orbit elements are posterior medians, which reproduce the data but are not a single self-consistent sample.
- **Model limb.** The limb darkening is a model atmosphere at the planet's temperature and gravity, in the middle band of its color, not a measurement of this planet.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
