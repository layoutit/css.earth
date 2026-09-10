# Gonggong

Gonggong is a large, distant trans-Neptunian world with the moon Xiangliu. Its smooth model follows a published thermal size interpretation; the viewing pole and surface detail are illustrative.

Published spherical thermophysical interpretation, diameter 1230 ±50 km. It assumes Xiangliu orbits near Gonggong’s equatorial plane; the unknown local surface is shown with the grid. Illustrative ICRF north pole (RA 0°, Dec +90°), arbitrary prime meridian and phase. No measured body pole or absolute surface attitude is claimed. The grid marks unmapped terrain.

Source: [Kiss et al. (2019), thermophysical modeling with Hubble satellite-orbit constraints.](https://doi.org/10.1016/j.icarus.2019.03.013). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: 1230 ±50 km spherical-model size conditioned on satellite equatorial alignment. Mirror orbit/spin alternatives remain.  https://doi.org/10.1016/j.icarus.2019.03.013
- Superseded-size: Earlier equator-on estimate 1535 +75/-225 km, revisited after satellite orbit constraints; not the selected diameter.  https://arxiv.org/abs/1603.03090
- Excluded-from-surface: Integrated JWST composition, not a registered photographic texture.  https://doi.org/10.1016/j.icarus.2024.116017

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
