# HD 206893 B

HD 206893 B is a dusty brown dwarf 11 au from its star. Small wobbles in its motion could be a moon of about 0.4 Jupiter masses, or instrument errors. Its star is [HD 206893](../hd-206893/README.md).

## Sources

**Orbit.** Kral et al. ([2026](https://arxiv.org/abs/2511.20091), A&A 705, A217) fit B and c together with orbitize! on VLTI/GRAVITY and SPHERE astrometry, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood; B's orbit uses the star's mass plus B's and c's, as orbitize! does ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). The distributed posterior is not the run in the paper's Table 2: its B mass centres near 7 Jupiter masses against the table's 19.5, but its orbit elements agree with the table within about one standard deviation, so the orbit comes from it and the mass from the table. The app draws B's own Keplerian orbit; the fit also moves the star under c's pull, which is why the orbit sits about 0.5 mas from each GRAVITY position (0.37 to 1.03 mas) while every earlier SPHERE position falls within 1.5 of its errors. The recorded orbit: a = 10.7 au, e = 0.06, i = 141.7°, period about 30 years. The path drawn is this orbit. Every element and its derivation is in [`hd-206893-b.json`](../../../packages/astronomy/data/bodies/hd-206893-b.json).

**Radius, temperature and mass.** Radius 1.79 Jupiter radii and 1,162 K from the Exo-REM fit to the GRAVITY spectrum and earlier photometry by Kral et al. ([2026](https://arxiv.org/abs/2511.20091)); their ATMO fit agrees (1.98 Jupiter radii, 1,097 K), while BT-Settl gives 0.93 and 1,582 K. Model values: B is unresolved. Mass 19.5 Jupiter masses, measured dynamically. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of HD 206893 B on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The orbit drawn leaves out the star's motion under c's pull, about half a milliarcsecond at GRAVITY's precision; invisible at 0.2 arcseconds.
- The distributed posterior's masses differ from the paper's table; the mass shown is the table's.
- The candidate moon is not drawn.
- The radius is a model value, and the models disagree by a factor of two.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
