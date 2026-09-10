# ʻOumuamua

The first confirmed interstellar visitor crossed the Solar System in 2017. Its changing brightness supports competing shape interpretations; this view shows one published disc-like fit, with size set by an assumed reflectivity.

Selected DISC light-curve model: full axes 115 × 111 × 19 m, assuming geometric albedo 0.1. The same study permits a 324 × 42 × 42 m CIGAR solution. These are competing inferred shapes; no resolved silhouette or surface map exists. Size depends on the assumed albedo. Arbitrary display pole and meridian. The object tumbles; this static view does not reconstruct its 2017 attitude or claim a current spin phase. The grid marks unmapped terrain.

Source: [Mashchenko (2019), MNRAS489,3003–3021, §4 and Table1](https://doi.org/10.1093/mnras/stz2378). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: Mashchenko2019 light-curve fits; selected DISC solution with the paper’s stated0.1 geometric albedo.
- Alternative: same paper’s CIGAR324 ×42 ×42 m solution remains viable; a familiar artist impression is not measured geometry.
- Excluded: NASA/ESO artist impressions as surface textures; telescopes measured only unresolved light.
- Included: Horizons2026-09-03 heliocentric osculating trajectory and independent vectors; not a simulation of non-gravitational acceleration or reconstruction of unknown origin.

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
