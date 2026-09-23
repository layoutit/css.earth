# PDS 70 c

PDS 70 c is a gas giant still forming inside the gap of [PDS 70](../pds-70/README.md)'s disc. ALMA sees a compact source of dust co-located with it, a disc of its own less than about 1.2 au in radius (Benisty et al. 2021, [arXiv:2108.07123](https://arxiv.org/abs/2108.07123)); the pipeline image drawn in the [dust ring](../pds-70-disc/README.md) is too noisy to show it.

## Sources

**Orbit.** Trevascus et al. (2025, A&A 698, A19; [arXiv:2504.11210](https://arxiv.org/abs/2504.11210)), Table 3, the "Stable (incl. N-body)" column: the posterior medians of an orbitize! fit to all published astrometry of b and c with their new VLTI/GRAVITY epochs, keeping only orbits that do not cross and stay stable. a 33.9 au, e 0.042, i 129.8° (clockwise on the sky), ω 77° (the planet's; stored as the star's), Ω 158.0° east of north, periastron τ 0.521 of a period after MJD 58849; the period, 201.6 years, follows from a³ = (M* + M) P² with the column's own stellar mass 0.952 solar masses. Of the paper's three columns this one fits their eight GRAVITY positions best (4.2 mas RMS, against 4.7 for the other two; [ledger](../pds-70/investigations.json)). Every element is in [`pds-70-c.json`](../../../packages/astronomy/data/bodies/pds-70-c.json).

**Checked against GRAVITY and the disc.** [hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts) puts the planet within 1.2 mas of all seven GRAVITY positions from 2021 and 2022 (Trevascus et al. 2025, Table 2). Astrometry alone cannot say which half of an orbit is nearer us; as published, the near half lies west, the side of the disc Keppler et al. (2018) find nearer, and the planet moves clockwise, as the disc turns.

**Radius, temperature and mass.** 1.98 +0.39/−0.31 Jupiter radii and 1,054 K from the atmosphere model with the most support in Wang et al. (2021, AJ 161, 148; [arXiv:2101.04187](https://arxiv.org/abs/2101.04187)), Table 5: DRIFT-PHOENIX with no extinction (Bayes factor 6.2 × 10⁷ against a plain blackbody). It is a model radius, and the models disagree: the paper's other fits give 0.6 to 2.4 Jupiter radii. The mass is dynamical, 6.4 +4.3/−3.7 Jupiter masses, from the same Trevascus et al. column.

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
