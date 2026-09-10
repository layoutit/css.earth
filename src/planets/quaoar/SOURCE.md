# Quaoar

This large Kuiper-belt object has two known rings. Its oblate shape is fitted to stellar occultations with the ring plane as a pole constraint; surface detail is unresolved.

Published 3D oblate fit: equatorial semiaxes 566.1 km and polar semiaxis 511.2 km. The fit assumes the body pole aligns with the rings. A competing triaxial interpretation is unresolved. Pole RA 259.7°, DEC 53.4° inherits the measured ring-plane prior; arbitrary meridian. The 8.8394 h and 17.6788 h period interpretations remain model-dependent and no sidereal spin is installed. The grid marks unmapped terrain.

Source: [Margoti et al. (2026), accepted ApJ; 36 stellar-occultation campaigns](https://arxiv.org/abs/2607.06450). Checked 2026-09-09. The source recipe pins units, model assumptions and numerical axes. Shadows and Orbit default off. Rendering uses the generic retained PolyCSS native u raster path. No runtime geometry is generated.

## Source survey

- Unresolved: Oblate versus triaxial shape and 8.8394 h versus 17.6788 h spin interpretations remain model-dependent.
- Unresolved: The 572.5 MB supplementary archive contains lightcurves/model profiles, not a resolved surface texture; downloading it is unnecessary for the published numeric fit.

Surface spectra and unresolved observations are not reconstructed surface textures. Reproduce source extraction with `python3 docs/trans-neptunian/author.py`; the existing preparation owners produce scene assets.
