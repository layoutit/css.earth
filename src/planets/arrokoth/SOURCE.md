# Arrokoth

New Horizons explored this cold-classical Kuiper-belt contact binary in 2019. The released shape preserves both lobes; the unseen northern surface is modeled.

Released New Horizons contact-binary shape: two overlapping closed lobe meshes. Southern surface detail is constrained by flyby imagery; the unseen side is a source model estimate. Revised pole from the bundled Porter paper Table 2. Its PDS XML gives an inconsistent earlier pole; the paper pole is used with arbitrary meridian and no precision spin-phase claim. The grid marks unmapped terrain.

Source: [Porter (2024), New Horizons Arrokoth shape model; NASA PDS](https://doi.org/10.26007/97r3-1e19). Checked 2026-09-09. The source recipe pins units, model assumptions and numerical axes. Shadows and Orbit default off. Rendering uses the generic retained PolyCSS native u raster path. No runtime geometry is generated.

## Source survey

- Unresolved: The released albedo FITS has no explicit observational coverage mask and contains a broad uniform baseline; that fill is not resolved imagery.
- Unresolved: The bundled paper and PDS XML disagree on the pole and the XML calls a sub-day period an orbital period. Absolute phase is not claimed.
- Unresolved: Published spin-period estimates differ: Buie et al. (2020) gives 15.9380 ± 0.0005 h, while the Porter archive labels 0.6632553 days as an orbital period. The panel reports only about 15.9 hours; no precision spin rate is installed.

Surface spectra and unresolved observations are not reconstructed surface textures. Reproduce source extraction with `python3 docs/trans-neptunian/author.py`; the existing preparation owners produce scene assets.
