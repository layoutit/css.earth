# PDS 70 b

PDS 70 b is a gas giant still forming inside the gap of [PDS 70](../pds-70/README.md)'s disc. Found in 2018 in VLT/SPHERE images (Keppler et al. 2018, [arXiv:1806.11568](https://arxiv.org/abs/1806.11568)).

## Sources

**Orbit.** Trevascus et al. (2025, A&A 698, A19; [arXiv:2504.11210](https://arxiv.org/abs/2504.11210)), Table 3, the "Stable (incl. N-body)" column: the posterior medians of an orbitize! fit to all published astrometry of b and c with their new VLTI/GRAVITY epochs, keeping only orbits that do not cross and stay stable. a 20.7 au, e 0.16, i 130.6° (clockwise on the sky), ω 190° (the planet's; stored as the star's), Ω 176° east of north, periastron τ 0.355 of a period after MJD 58849; the period, 96.5 years, follows from a³ = (M* + M) P² with the column's own stellar mass 0.952 solar masses. Of the paper's three columns this one fits their eight GRAVITY positions best (4.2 mas RMS, against 4.7 for the other two; [ledger](../pds-70/investigations.json)). Every element is in [`pds-70-b.json`](../../../packages/astronomy/data/bodies/pds-70-b.json).

**Checked against GRAVITY and the disc.** [hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts) puts the planet 11.6 mas from its one GRAVITY position of 24 February 2022 (Trevascus et al. 2025, Table 2). Astrometry alone cannot say which half of an orbit is nearer us; as published, the near half lies west, the side of the disc Keppler et al. (2018) find nearer, and the planet moves clockwise, as the disc turns.

**Radius, temperature and mass.** 1.96 +0.20/−0.17 Jupiter radii and 1,392 K from the atmosphere model with the most support in Wang et al. (2021, AJ 161, 148; [arXiv:2101.04187](https://arxiv.org/abs/2101.04187)), Table 4: BT-SETTL with ISM extinction and a second blackbody (Bayes factor 147 against a plain blackbody). It is a model radius, and the models disagree: the paper's other fits give 1.3 to 3.6 Jupiter radii. The mass is dynamical, 1.4 +2.1/−1.0 Jupiter masses, from the same Trevascus et al. column.

**Its own light.** The planet is drawn self-luminous, as the other imaged planets are: its glow is its own heat.

**Shape lens.** A sphere of the model radius in the shared neutral gray: the planet is a point in every image, and no colour of it in comparable bands is measured.

**Rotation.** None measured. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) checks the GRAVITY positions, the near side and the direction of motion (above); the astronomy package's 857 tests pass.

## Known problems

- The radius and temperature are model values, and the models disagree (above).
- The orbit is the median of a posterior, not one fitted orbit; the dynamical mass is wide.
- No spin is measured; the axis shown is the orbit normal.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
