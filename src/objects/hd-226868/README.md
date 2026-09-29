# HD 226868

## Sources

HD 226868 is the blue supergiant of Cygnus X-1, the first X-ray source widely accepted to be a black hole. The star is 22 times as wide as the Sun and 31,000 K at its surface. Its black hole orbits 0.24 au away, closer than Mercury is to the Sun, every 5.6 days. It is also HIP 98298. This account was drafted from Miller-Jones et al. (2021), Science 371, 1046's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2059383668236814720, parallax 0.444 ± 0.015 mas (2252.75 pc). Radius 22.3 solar radii from Miller-Jones et al. (2021), Science 371, 1046, Table 1: R1 = 22.3 solar radii (median; 5th-95th percentile 20.6-24.1), derived from their dynamical model at 2.22 kpc (https://arxiv.org/abs/2102.09091). Mass 40.6 solar masses from Miller-Jones et al. (2021), Science 371, 1046, Table 1: M1 = 40.6 solar masses (median; 5th-95th percentile 33.5-48.3), fitted (https://arxiv.org/abs/2102.09091). Temperature 31,138 K from Miller-Jones et al. (2021), Science 371, 1046, Table 1: Teff = 31,138 K (median; 5th-95th percentile 30,398-31,840 K), fitted. log g 3.348 from Miller-Jones et al. (2021), Science 371, 1046, Table 1: log g1 = 3.348 (median; 5th-95th percentile 3.335-3.360), derived.

**Colour.** A Planck spectrum at 31,138 K, because interstellar dust reddens every spectrum of this star: E(B-V) = 1.11 +/- 0.03 and A_V = 3.35 (Caballero-Nieves et al. 2009, as adopted by Orosz et al. 2011, ApJ 742, 84, section 3.2, https://arxiv.org/abs/1106.3689), which the colour routes do not remove, so a measured spectrum would show the dust's colour and not the star's, through the CIE 1931 2° observer: #a1bbff. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Reeve & Howarth (2016), MNRAS 456, 1294 compute from non-LTE TLUSTY model atmospheres for the Bessell V band at 31,138 K and log g 3.348 (u1 0.124, u2 0.330): a model, because no fit of this star's limb is used.

**Black hole and orbit.** The black hole is the astronomy record [`cygnus-x-1`](../../../packages/astronomy/data/bodies/cygnus-x-1.json), drawn in this star's system with no page of its own. Its mass, 21.2 solar masses, is Miller-Jones et al. (2021), Table 1. Nothing measures its size, so the record keeps the unmeasured radius 0 and it is drawn as a point. The orbit is the relative orbit of the pair:

| Element | Value | Source |
| --- | --- | --- |
| Period | 5.599836 d | Brocksopp et al. (1999, A&A 343, 861; [arXiv:astro-ph/9812077](https://arxiv.org/abs/astro-ph/9812077)), Table 3, photometric column, the ephemeris Miller-Jones et al. adopt |
| Separation | 0.244 au, 2.3528 star radii | Miller-Jones et al. (2021), Table 1 |
| Tilt | 27.51°, written 152.49° | Table 1; clockwise on the sky by their astrometric fit (Table S3, i = 152.9 ± 0.7°) |
| Eccentricity | 0.0189 | Table 1 |
| Periastron | black hole's ω 306.6°, stored as the star's 126.6° | Table 1 |
| Timing | periastron at BMJD 41160.8322 | worked out from Brocksopp's superior conjunction of the black hole, HJD 2441163.529, moved by Miller-Jones et al.'s fitted phase offset of 0.0024 period |
| Node | 64.1° east of north | Table S3, 1-D fit; it assumes the jet lies along the orbit's axis |

`packages/astronomy/src/hostedOrbits.test.ts` checks the timing against Brocksopp et al.'s other ephemeris, the one fitted to radial velocities (Table 3, spectroscopic column: HJD 2441874.707, P = 5.599829 d): at every 50th conjunction from 1973 to 2026 the black hole is behind the star, as far along the line of sight as a 27.5° tilt allows, and in front half an orbit later. With the periastron angle stored the other way round the black hole is in front at the first conjunction, so the check can tell the two apart.

## Evidence

[The rendered page](evidence/rendered-page.png) (dev server, 900 × 900 headless Chromium, 2026-09-27): the blue-white disc at its Planck colour, dimmed toward the edge by the TLUSTY limb law.

Generated 2026-09-27 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star nearly fills its Roche lobe (filling factor 0.96, Miller-Jones et al. 2021, Table 1), so it is slightly egg-shaped; it is drawn as a sphere at its mean radius.
- **Not shown.** The accretion disc and the radio jet of the black hole are not drawn.
- **Not shown.** The black hole has no measured size and is drawn as a point on its orbit.
- **Orientation on the sky.** The node angle comes from Miller-Jones et al.'s assumption that the jet lies along the orbit's axis. Without it their fit gives 95 ± 18° instead of 64.1°.
- **Distance.** The star is placed at Gaia DR3's 2,253 pc. Miller-Jones et al. derived its radius and mass at their radio distance, 2.22 (+0.18/−0.17) kpc; the two agree within their errors.
- **Drafted text.** The card and introduction were drafted for this package from Miller-Jones et al. (2021)'s Table 1 values; their quotes are sentences of the Wikipedia article "Cygnus X-1" (revision 1374065663), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
