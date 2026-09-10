# Sedna

Sedna follows an exceptionally distant, elongated orbit beyond the planetary region. This grid-covered illustration conveys its thermal size estimate; its actual shape and surface terrain remain unresolved.

Size-constrained spherical illustration at the 995 ±80 km thermal diameter. Herschel constrains effective size, not three axes; no resolved global shape or topography is represented. Illustrative ICRF north pole (RA 0°, Dec +90°), arbitrary prime meridian and phase. No measured body pole or absolute surface attitude is claimed. The grid marks unmapped terrain.

Source: [Pál et al. (2012), Herschel/PACS thermophysical analysis; Gaudi et al. (2005), rotational photometry.](https://arxiv.org/abs/1204.0899). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: Herschel effective primary diameter; equal axes remain illustrative.  https://arxiv.org/abs/1204.0899
- Included: Small photometric variation and rotation candidates; insufficient to select unique 3D axes.  https://doi.org/10.1086/444355
- Excluded-from-surface: JWST spectroscopy constrains integrated composition; it supplies no registered terrain or albedo map.  https://doi.org/10.1016/j.icarus.2024.116017

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
