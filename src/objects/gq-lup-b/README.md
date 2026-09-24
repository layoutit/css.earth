# GQ Lup b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

GQ Lup b is a young, accreting companion of about 30 Jupiter masses, 0.7 arcseconds (about 100 au) from [GQ Lup](../gq-lup/README.md). It glows at about 2,700 K and still has a disc of its own (Stolker et al. [2021](https://arxiv.org/abs/2110.04307)).

## Sources

**Orbit.** Venkatesan et al. ([2025](https://arxiv.org/abs/2509.20621), ApJ 993, 69) fit eight literature positions (their Table 2), four VLTI/GRAVITY positions measured to 0.03 to 0.15 mas (Table 3) and the CRIRES radial velocity of the companion relative to the star, 2.0 ± 0.4 km/s (Table 4), with orbitize!, and publish medians only (Table 6: a 97.7 au, e 0.35, i 48.2°, Ω 257°). [`orbitize-fit.py`](../../../tools/objects/hosted-orbits/orbitize-fit.py) reruns that fit on the same inputs and priors (total mass 1.05 ± 0.07 solar masses, parallax 6.489 ± 0.029 mas) with fewer walkers and steps than the paper, and keeps the maximum of the posterior, refined from many starts including the paper's medians ([fit.json](source/orbits/fit.json)). The medians themselves are not one orbit: they miss GRAVITY's positions by 7 mas. The recorded orbit: a = 101 au at the Gaia DR3 distance, e = 0.31, i = 49.4°, period about 984 years. The path drawn is this orbit. Every element and its derivation is in [`gq-lup-b.json`](../../../packages/astronomy/data/bodies/gq-lup-b.json).

**Radius, temperature and mass.** Radius 3.77 Jupiter radii and temperature 2700 K: the BT-Settl fit with extinction to the combined VLT/MUSE and SINFONI spectra of Stolker et al. (2021, AJ; doi:10.3847/1538-3881/ac2c7f; arXiv:2110.04307), Table 4: 269,524.8 km at 71,492 km per Jupiter radius. A model radius, not a measured diameter. Cugno et al. (2024, arXiv:2404.07086) refit the same spectra with JWST/MIRI and find 3.60 to 3.71 and 2700 to 2719 K. GM from the evolutionary-model mass 33 +/- 10 Jupiter masses of Xuan et al. (2024, arXiv:2405.13128, Table 1) times Jupiter's GM; published masses range from about 10 to 40. A sphere: no oblateness is measured.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray. No paper gives its flux in three bands comparable with HR 8799's planets, whose false colour comes from JWST (the [ledger](investigations.json) says what would change that).

**Rotation.** No spin axis on the sky is measured; the display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The GRAVITY positions are so precise that the recorded orbit still misses the latest by a few tenths of a milliarcsecond, several times its error; on a 0.7-arcsecond separation that is invisible.
- The radius and mass are model values; the planet is a point in every image.
- No colour is measured in bands comparable with HR 8799's, and no spin axis is measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
