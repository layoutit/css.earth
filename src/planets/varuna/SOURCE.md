# Varuna

Varuna’s rapid rotation and changing brightness reveal an elongated world beyond Neptune. This smooth model follows a published light-curve fit; its absolute size remains approximate.

Illustrative scale model of the published Jacobi fit: b/a=0.60, c/b=0.72, scaled to the paper’s adopted approximate 700 km volume-equivalent diameter. These smooth axes are inferred, not resolved terrain. Uses one published pole interpretation, ecliptic longitude 53° ±10° and latitude −64° ±6°, converted with the J2000 mean obliquity for display. The antipodal pole is also allowed; equinox and meridian are display conventions, not a qualified absolute attitude. The grid marks unmapped terrain.

Source: [Fernández-Valenzuela et al. (2019), ApJL; multi-epoch rotational photometry](https://arxiv.org/abs/1909.04698). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: Three-dimensional axis ratios, pole interpretations, period and approximate model scale Published numerical light-curve model; no re-fitting or invented terrain. https://arxiv.org/abs/1909.04698
- Excluded: Rotationally resolved near-infrared spectroscopy Unresolved spectra do not provide spatially registered surface texels. https://arxiv.org/abs/1401.5962
- Unresolved: JWST Varuna observing-program overview The overview identifies spectral and imaging observations, not a released global surface map; no texture is inferred from the program description. https://www.hou.usra.edu/meetings/acm2023/pdf/2534.pdf

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
