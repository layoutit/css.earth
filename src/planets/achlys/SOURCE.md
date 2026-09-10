# Achlys

Formerly 2003 AZ84, Achlys is a plutino in Neptune’s 3: 2 orbital resonance. Its changing occultation silhouette supports a flattened, elongated model, while a grazing event hints at a local depression.

Published Jacobi-ellipsoid interpretation, with semiaxes 470 ±20, 383 ±10 and 245 ±8 km. It assumes hydrostatic equilibrium and a 6.75-hour rotation; the smooth shape is inferred from occultations, not imaged terrain. Illustrative pole RA 0°, declination 90° and arbitrary meridian. The paper’s local projected-limb and opening angles do not provide a unique absolute surface attitude for this display. The grid marks unmapped terrain.

Source: [Dias-Oliveira et al. (2017), AJ 154, 22; four stellar occultations](https://arxiv.org/abs/1705.10895). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: Published 3D Jacobi dimensions constrained by multiple occultations Use the stated model dimensions through the existing ellipsoid recipe. https://arxiv.org/abs/1705.10895
- Excluded: JWST/NIRSpec spectrum of 2003 AZ84 The source explicitly treats this target as spatially unresolved; a spectrum cannot become registered surface texels. https://doi.org/10.1051/0004-6361/202346998
- Included: Official 2025 name assignment Use Achlys and retain 2003 AZ84 as a search alias. https://www.wgsbn-iau.org/files/Bulletins/V005/WGSBNBull_V005_015.pdf

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
