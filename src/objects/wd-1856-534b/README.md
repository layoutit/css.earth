# WD 1856+534 b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

A giant planet 0.946 Jupiter radii across, circling its white dwarf every 1.408 days. It is drawn as a gray sphere at its measured size, lit by its star.

## Sources

- Radius: [Limbach et al. (2025)](https://arxiv.org/abs/2504.16982), Table 1, 0.946 ± 0.017 Jupiter radii.
- Orbit shape: [Vanderburg et al. (2020)](https://doi.org/10.1038/s41586-020-2713-y), Table 1, circular fit: a/R* = 336 ± 14, inclination 88.778 ± 0.059°.
- Period and transit time: [Gendreau-Distler et al. (2026)](https://doi.org/10.3847/1538-3881/ae8c30), Table 2, constant-period model: 1.407939211 d, reference transit 2459204.572725 BJD_TDB. The same paper limits the eccentricity to about 0.01, so the orbit is circular.
- Heat: Limbach et al. (2025) measure a 186 K mid-infrared brightness temperature with JWST MIRI (programme 5204). It is shown as a fact, not as an image.

a/R* is multiplied by the Limbach stellar radius, which puts the planet at 0.0189 AU. Vanderburg et al. give 0.0204 AU from their larger star. [MacDonald et al. (2026)](https://doi.org/10.1038/s41586-026-10514-7) refit a/R* = 339 ± 6 from JWST, which agrees.

No mass is adopted. Only bounds are published: at least 0.84 Jupiter masses ([Xu et al. 2021](https://doi.org/10.3847/1538-3881/ac2d26)) and at most about 5.2 (Limbach et al. 2025).

Rotation is assumed synchronous. Limbach et al. (2025) expect tidal locking; no spin is measured.

## Evidence

See the [system evidence](../wd-1856-534/evidence/README.md).

## Known problems

- No visible colour or image of the planet exists; the gray is a display convention.
- The ascending node on the sky is unmeasured and set to celestial north.
- JWST programmes 9033 and 9157 (MIRI phase curve and IFU) are partly still exclusive and unpublished; see the ledger.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
