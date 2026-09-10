# Orcus

Orcus is a large resonant world beyond Neptune, partnered with the substantial moon Vanth. The displayed size belongs to Orcus alone; its smooth shape and grid surface are illustrative.

Size-constrained spherical illustration at Orcus’s primary-only thermal diameter, 910 +50/−40 km. ALMA separated the binary components but did not resolve Orcus’s terrain or measure three shape axes. Illustrative ICRF north pole (RA 0°, Dec +90°), arbitrary prime meridian and phase. No measured body pole or absolute surface attitude is claimed. The grid marks unmapped terrain.

Source: [Brown and Butler (2018), resolved ALMA binary photometry with Spitzer/Herschel thermal modeling.](https://arxiv.org/abs/1801.07221). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: Separately modeled Orcus and Vanth thermal fluxes avoid using a system-equivalent diameter.  https://arxiv.org/abs/1801.07221
- Included-context: Binary astrometric mass ratio and likely double-synchronous evolution; not unique spin attitude or shape.  https://arxiv.org/abs/2307.04848
- Excluded-from-surface: JWST spectral characterization references include Orcus; no resolved longitude-latitude map.  https://arxiv.org/abs/2508.17101
- Excluded-wrong-component: The 2017 occultation constrains Vanth, not Orcus; cannot use its 443 km diameter for the primary.  https://arxiv.org/abs/1810.08977

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
