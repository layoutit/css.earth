# Beta Pictoris d

Beta Pictoris d is a cool giant planet about 26 au from [Beta Pictoris](../beta-pictoris/README.md), announced in 2026 after it had hidden in a decade of images.

## Sources

**Orbit.** Sutlieff, Bonse et al. (2026, [arXiv:2606.23801](https://arxiv.org/abs/2606.23801)), Table 2: a 26.0 +2.2/−6.1 au, inclination 89.0 +0.7/−0.6°, node 210.8 +0.6/−0.4° (prior-independent), eccentricity below 0.44 at 2σ, period 91 +18/−27 years. Their orbit is still poorly constrained, so this record is a circular orbit at the published semi-major axis, inclination and node, with a Kepler period of 99.6 years for the system's mass. Its phase is fitted to the six measured positions in their Table 1 (VLT/SPHERE 2014, 2019, 2020; JWST/NIRCam 2023, 2025; VLT/ERIS 2025): χ² 12.5 for 11 degrees of freedom, every residual within 35 mas ([hostedOrbits.test.ts](../../../packages/astronomy/src/hostedOrbits.test.ts)). A free circular fit would prefer 94.5 years.

**Radius and mass.** 1.26 ± 0.03 Jupiter radii and 2.4 ± 0.6 Jupiter masses, evolutionary-model estimates from the planet's photometry (Sutlieff et al. 2026, Table 2), at 600 K. Neither is measured directly.

**Rotation.** Not measured; the display axis is the orbit normal and nothing turns.

**Shape lens.** A sphere of the model radius in the shared neutral gray, self-luminous.

## Evidence

Run of 2026-09-22 (this version): `node tools/prepare/prepare-object.mts beta-pictoris-d` prepared the package through its world step; the orbit test above passes. The planet's orbit lies inside the disc's visible-light lens, 16 to 82 au ([disc README](../beta-pictoris-disc/README.md)).

## Known problems

- The orbit is circular by convention; the paper bounds the eccentricity but gives no median.
- Radius and mass are model values.
- No rotation is measured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
