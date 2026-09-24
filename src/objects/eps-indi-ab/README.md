# Epsilon Indi Ab

Epsilon Indi Ab is a cold giant planet about 16 au from its star. JWST first imaged it in 2023, and has since taken the longest-wavelength image of any exoplanet. Its star is [Epsilon Indi A](../eps-indi-a/README.md).

## Sources

**Orbit.** Sanghi et al. ([2026](https://arxiv.org/abs/2603.08787), AJ) fit three decades of radial velocities of the star, with a Gaussian-process model of its magnetic activity, together with its Hipparcos-Gaia acceleration and the planet's JWST/MIRI, JWST/NIRCam and VLT/VISIR positions, using Octofitter. They publish the posterior of every model on Zenodo ([doi:10.5281/zenodo.19931118](https://doi.org/10.5281/zenodo.19931118), CC BY 4.0). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of the 32,768 samples of their fiducial model ([pick.json](source/orbits/pick.json)), the one with the highest log-posterior; the highest likelihood alone sits at a star mass of 0.84 solar masses, which their asteroseismic prior of 0.782 ± 0.023 rules out. PlanetOrbits.jl, which Octofitter orbits are computed with, writes the sky offsets with the same formulas as orbitize!, so the elements carry over unchanged. The orbit passes the JWST/MIRI position of 2023 July 3 within 1.9 of its errors and the JWST/NIRCam position of 2025 August 28 within 0.9 ([orbit.json](source/orbits/orbit.json)). The recorded orbit: a = 15.8 au, e = 0.21, i = 100.7°, period about 70 years, next periastron in 2043. Matthews et al. ([2026](https://arxiv.org/abs/2603.08780)) fit a similar orbit with orvara and a third JWST position (2025 May 10) that this fit did not use; the orbit drawn misses that one by 0.3 degrees in position angle, nine of its errors. The path drawn is this orbit. Every element and its derivation is in [`eps-indi-ab.json`](../../../packages/astronomy/data/bodies/eps-indi-ab.json).

**Radius, temperature and mass.** Radius 1.05 ± 0.01 Jupiter radii and 275 ± 5 K from evolutionary models at the planet's dynamical mass, its age and its luminosity measured by integrating its 4 to 25 micron energy distribution (Sanghi et al. [2026](https://arxiv.org/abs/2603.08787), section 5). Model values: the planet is unresolved. Mass 6.5 Jupiter masses, measured dynamically. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray ([ledger](investigations.json)).

**Rotation.** No rotation period or spin axis of Epsilon Indi Ab is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- The orbit drawn is one sample of a posterior whose semi-major axis spans 14.4 to 17.5 au and eccentricity 0.16 to 0.34 (16th to 84th percentiles): two years of imaging cover a small arc of a 70-year orbit.
- It misses the 2025 May JWST position of Matthews et al. (2026), which the fit did not use, by 0.3 degrees.
- The radius is a model value; the planet is a point in every image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
