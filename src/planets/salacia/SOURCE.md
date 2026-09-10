# Salacia

Salacia is a large, dark Kuiper-belt world with the moon Actaea. Long-term photometry supports a synchronized binary. This grid-covered illustration uses a separately estimated primary size, not a resolved surface.

Size-constrained spherical illustration at the primary-only 838 ±44 km ALMA/NEATM estimate. This value is from a 2025 conference abstract; no resolved three-axis shape is provided. Illustrative ICRF north pole (RA 0°, Dec +90°), arbitrary prime meridian and phase. No measured body pole or absolute surface attitude is claimed. The grid marks unmapped terrain.

Source: [Kiss et al. (2025), EPSC-DPS conference thermal-model result; Collyer et al. (2025), synchronous rotation.](https://doi.org/10.5194/epsc-dps2025-905). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: New ALMA observations separate Salacia and Actaea, with distinct diameters and albedos. Conference abstract status retained.  https://doi.org/10.5194/epsc-dps2025-905
- Included-context: 16 years of photometry favor albedo variation and a 5.494-day synchronous rotation, rather than a triaxial explanation of the lightcurve.  https://arxiv.org/abs/2509.02734
- Excluded-from-surface: JWST Salacia-Actaea spectrum is spatially blended; its901 km discussion concerns the system and cannot set this primary’s axes.  https://arxiv.org/abs/2508.17101
- Superseded-size: Older 866 ±37 km estimate used equal-albedo binary partitioning; newer resolved-component result selected.  https://doi.org/10.3847/1538-3881/aa6346

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
