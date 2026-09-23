# Sagittarius A*

The black hole at the centre of the Milky Way, drawn as a black disc the size of its measured shadow that always faces the
viewer, with the EHT's image of it around the disc and the S-stars on their published orbits.

## Sources

| What | Value | Source |
| --- | --- | --- |
| Position | ICRS 266.4168166°, −29.0078250° | SIMBAD `NAME Sgr A*`, coordinate reference 2011AJ....142...35P (Petrov et al. 2011, VLBA) |
| Distance | 8277 ± 9 pc | GRAVITY Collaboration (2022, A&A 657, L12; [arXiv:2112.07478](https://arxiv.org/abs/2112.07478)), Table 1 |
| Mass | 4.297 ± 0.012 million solar masses | GRAVITY Collaboration (2022), Table 1 |
| Shadow | 48.7 ± 7.0 µas across, from EHT data alone | EHT Collaboration (2022, ApJL 930, L12; [arXiv:2311.08680](https://arxiv.org/abs/2311.08680)), Sgr A* Paper I, Table 1 |
| Proper motion | −6.411, −0.219 mas/yr (Galactic), −3.153, −5.586 mas/yr (ICRS) | Reid & Brunthaler (2020, ApJ 892, 39; [arXiv:2001.04386](https://arxiv.org/abs/2001.04386)), converted with Astropy 8.0.1 |
| Radial velocity | −1.8 ± 1.3 km/s | GRAVITY Collaboration (2022), Table 1, v_z0 of the mass centre |

The sphere's radius is half the shadow diameter at 8277 pc: 0.2015 au, 30,150,695 km. It is the dark region an observer
sees, not an event horizon. The black colour is that dark region, not a measured surface; the catalogue dot is the shared
neutral gray because nothing about it has a measured colour. The display axis is celestial north at the star: no spin axis
is measured, and EHT Sgr A* Paper V ([arXiv:2311.09478](https://arxiv.org/abs/2311.09478)) says its favoured models "cannot
be regarded as evidence" of a positive spin or a low inclination.

## The EHT image

The collaboration released its calibrated 2017 data (release 2022-D02-01) and its imaging pipelines, not the image. The
image here is made with those: EHT's eht-imaging pipeline, run on the April 7 low- and high-band data for 200 parameter
combinations drawn with a fixed seed from the 5594 of its Top Set (EHT Collaboration 2022, Sgr A* Paper III,
[arXiv:2311.09479](https://arxiv.org/abs/2311.09479), Table "Parameters in the eht-imaging Pipeline Top Set"), then averaged.
It sits behind the shadow disc, turned so celestial north is where the scene's sky has it, on eht-imaging's own display
colour map (matplotlib afmhot), with opacity following the light.

## The S-stars

The 40 stars around it are astronomy records in `packages/astronomy/data/bodies/`, each citing its orbit and size. They are
drawn from those records, without pages of their own, until each gets a package. S301 comes from its discovery paper
(GRAVITY Collaboration 2026, [arXiv:2607.12664](https://arxiv.org/abs/2607.12664)). The other 39 are written by
`packages/astronomy/tools/generate-s-stars.mts`, which reads every value from its publication:

| What | Source |
| --- | --- |
| Orbits of 39 stars | Gillessen et al. (2017, ApJ 837, 30), table3 as VizieR serves it (J/ApJ/837/30) |
| Newer orbits of S2, S29, S38 and S55 | GRAVITY Collaboration (2022, A&A 657, L12; [arXiv:2112.07478](https://arxiv.org/abs/2112.07478)), Table 1, read from the paper's LaTeX |
| Which orbits are well measured | Gillessen et al. (2017; [arXiv:1611.09144](https://arxiv.org/abs/1611.09144)), Sect. 3.4.1, read from the paper's LaTeX |
| Radius and mass of S1, S2, S4, S6, S8, S9 and S12 | Habibi et al. (2017, ApJ 847, 120; [arXiv:1708.06353](https://arxiv.org/abs/1708.06353)), Table 3, read from the paper's LaTeX |

An orbit is drawn when its paper judges it well measured: Gillessen et al. (2017) fit 17 stars together to weigh the black
hole (an orbit qualifies with at least 8 measured dynamical quantities, including a radial-velocity term), and GRAVITY (2022)
refits S29 as well. The other 21 orbits are fitted from a short arc; those stars are placed by their published orbit and
drawn as a circle, without a path. The 32 stars with no measured radius record it as 0, which means "not measured".

The angular orbits are placed at 8277 pc. Gillessen et al. (2017) fitted at 8320 pc, so the physical sizes shift by 0.5%.

## Evidence

The orbit convention is measured, not assumed. With i and Ω as published and ω + 180°, this repository's hosted orbit
reproduces the positions Gillessen et al. (2017, ApJ 837, 30; VizieR J/ApJ/837/30, table5) measured for S2 (145 positions,
1992–2016) to 2.08 mas rms and for S1 (161) to 3.17 mas rms, and S2's 44 radial velocities to 31.9 km/s rms. The mirror
orientation that fits the positions equally misses the radial velocities by 1551 km/s.

Table5 holds the astrometry of exactly the 17 stars fitted together. All 17 generated records reproduce it: positions to
1.6–9.1 mas rms (S4 best, S54 worst, on orbits hundreds to thousands of mas across), and radial velocities within their
errors (χ²/n 0.3–1.5) for every star but S55. S55's two 2014 velocities (−400 ± 210 and −732 ± 145 km/s) are missed by
the GRAVITY (2022) orbit (−122 and −152) and by Gillessen's own 2017 orbit (−218 and −252) alike, so the difference is in
those two measurements, not in the mapping. S29 has no table5 data. Checked on 2026-09-22 against the records this README
describes.

## Known problems

- The EHT image is a sampled mean: 200 of Paper III's 5594 eht-imaging Top Set reconstructions for 2017 April 7, drawn with
  a fixed seed. Halving the sample moves it by 1.9% of its peak rms (7.9% at the worst pixel). Paper III's own figure
  averages every Top Set image of every pipeline. The image field is the pipeline's 150 microarcseconds; its faint edge
  light is part of the reconstruction.
- The orbits are Keplerian. S2's orbit precesses by about 12 arcminutes per revolution and S301's by about 1.9 degrees; that
  is not drawn.
- S301 has two orbit orientations that fit equally well without radial velocities; the one shown is the discovery paper's
  Solution 1.
- S111 is not shown. Gillessen et al. (2017) fit it with e = 1.092 ± 0.064 and a negative semi-major axis: an unbound
  path, which a hosted orbit cannot place.
- Stars found after 2017 (Peißker et al.'s S62 and S4711–S4716) are not in table3 and are not shown.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
