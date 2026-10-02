# Sagittarius A*

The black hole at the centre of the Milky Way, drawn as a black disc the size of its measured shadow that always faces the viewer, with the EHT's image of it around the disc and the S-stars on their published orbits. The [navigation marker](source/preparation/navigation.json) is a schematic gray placeholder; its shading is a display convention.

## Sources

| What | Value | Source |
| --- | --- | --- |
| Position | ICRS 266.4168166°, −29.0078250° | SIMBAD `NAME Sgr A*`, coordinate reference 2011AJ....142...35P (Petrov et al. 2011, VLBA) |
| Distance | 8277 ± 9 pc | GRAVITY Collaboration (2022, A&A 657, L12; [arXiv:2112.07478](https://arxiv.org/abs/2112.07478)), Table 1 |
| Mass | 4.297 ± 0.012 million solar masses | GRAVITY Collaboration (2022), Table 1 |
| Shadow | 48.7 ± 7.0 µas across, from EHT data alone | EHT Collaboration (2022, ApJL 930, L12; [arXiv:2311.08680](https://arxiv.org/abs/2311.08680)), Sgr A* Paper I, Table 1 |
| Proper motion | −6.411, −0.219 mas/yr (Galactic), −3.153, −5.586 mas/yr (ICRS) | Reid & Brunthaler (2020, ApJ 892, 39; [arXiv:2001.04386](https://arxiv.org/abs/2001.04386)), converted with Astropy 8.0.1 |
| Radial velocity | −1.8 ± 1.3 km/s | GRAVITY Collaboration (2022), Table 1, v_z0 of the mass centre |

The sphere's radius is half the shadow diameter at 8277 pc: 0.2015 au, 30,150,695 km. It is the dark region an observer sees, not an event horizon or a measured surface. The display axis is celestial north: no spin axis is measured, and EHT Sgr A* Paper V ([arXiv:2311.09478](https://arxiv.org/abs/2311.09478)) says its favoured models "cannot be regarded as evidence" of a positive spin or a low inclination.

## The EHT image

The collaboration released its calibrated 2017 data (release 2022-D02-01) and its imaging pipelines, not the image. The image here runs EHT's eht-imaging pipeline on the April 7 low- and high-band data for 200 parameter combinations, drawn with a fixed seed from the 5594 of its Top Set (EHT Collaboration 2022, Sgr A* Paper III, [arXiv:2311.09479](https://arxiv.org/abs/2311.09479)), then averages them. It sits behind the shadow disc with celestial north where the scene's sky has it, in eht-imaging's own colour map (matplotlib afmhot), with opacity following the light. `node packages/bake/authoring/eht/topset-mean.mts sgr-a-star` remakes it from [the recipe](source/preparation/eht-topset.json).

## The S-stars

The 40 stars are astronomy records in `packages/astronomy/data/bodies/`, each citing its orbit and size. [S2](../s2/README.md) also has its own package. S301 comes from its discovery paper (GRAVITY Collaboration 2026, [arXiv:2607.12664](https://arxiv.org/abs/2607.12664)). The other 39 are written by `packages/astronomy/cli/generate-s-stars.mts`, which reads every value from its publication:

| What | Source |
| --- | --- |
| Orbits of 39 stars | Gillessen et al. (2017, ApJ 837, 30), table3 as VizieR serves it (J/ApJ/837/30) |
| Newer orbits of S2, S29, S38 and S55 | GRAVITY Collaboration (2022, A&A 657, L12; [arXiv:2112.07478](https://arxiv.org/abs/2112.07478)), Table 1, read from the paper's LaTeX |
| Which orbits are well measured | Gillessen et al. (2017; [arXiv:1611.09144](https://arxiv.org/abs/1611.09144)), Sect. 3.4.1, read from the paper's LaTeX |
| Radius and mass of S1, S2, S4, S6, S8, S9 and S12 | Habibi et al. (2017, ApJ 847, 120; [arXiv:1708.06353](https://arxiv.org/abs/1708.06353)), Table 3, read from the paper's LaTeX |

An orbit is drawn when its paper judges it well measured: the 17 stars Gillessen et al. (2017) fit together, plus S29 as refitted by GRAVITY (2022). The other 21 are fitted from a short arc, so those stars are placed on their published orbit without a path. The 32 stars with no measured radius record 0, meaning "not measured". Orbits are placed at 8277 pc; Gillessen et al. fitted at 8320 pc, so physical sizes shift by 0.5%.

## The cluster around them

Zooming out, the dots around the S-stars are the nuclear star cluster: 5,610 stars of the GALACTICNUCLEUS survey at their measured sky positions, at modelled depths. They are their own package, the [nuclear star cluster](../nuclear-star-cluster/README.md), loaded while Sgr A* or one of its stars is selected.

## Evidence

With i and Ω as published and ω + 180°, the hosted orbit reproduces the positions Gillessen et al. (2017, table5) measured for S2 (145 positions, 1992–2016) to 2.08 mas rms and for S1 (161) to 3.17 mas rms, and S2's 44 radial velocities to 31.9 km/s rms. The mirror orientation misses the radial velocities by 1551 km/s.

All 17 stars in table5 reproduce its positions to 1.6–9.1 mas rms and its radial velocities within their errors (χ²/n 0.3–1.5), except S55. S55's two 2014 velocities (−400 ± 210 and −732 ± 145 km/s) are missed by the GRAVITY (2022) orbit (−122 and −152) and by Gillessen's own 2017 orbit (−218 and −252) alike, so the difference lies in those measurements, not the mapping.

## Known problems

- The EHT image is a sampled mean of 200 reconstructions. Halving the sample moves it by 1.9% of its peak rms (7.9% at the worst pixel). Paper III's own figure averages every Top Set image of every pipeline. The faint edge light in the 150 microarcsecond field is part of the reconstruction.
- The orbits are Keplerian. S2's orbit precesses by about 12 arcminutes per revolution and S301's by about 1.9 degrees; that is not drawn.
- S301 has two orbit orientations that fit equally well without radial velocities; the one shown is the discovery paper's Solution 1.
- S111 is not shown. Gillessen et al. (2017) fit it with e = 1.092 ± 0.064, an unbound path a hosted orbit cannot place.
- Stars found after 2017 (Peißker et al.'s S62 and S4711–S4716) are not in table3 and are not shown.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
