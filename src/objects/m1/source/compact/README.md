# Compact Crab bake inputs

These are retained pre-slice scientific/model inputs. They contain no runtime atlas or slice raster.

- `particles.fits.gz`: losslessly compressed released XYZ/flux samples, independently pinned in the sampled recipe.
- `*-colors.f64.gz`: one RGB chromaticity and coverage flag per measured particle, in source row order. Float64 values preserve the existing computation exactly. The zero-ejecta X-ray lens stores zero point colors; its wind components carry its appearance.
- `model.json.gz`: fitted finite diffuse atoms, strengths, component colors, spectral mixtures, stars, frame, settings, source credits, and accepted output hashes.

The shared compact sampled replayer reconstructs the emission/material grids, integrates XYZ slabs, registers the component geometry, and prepares star sprites. The delivery pipeline creates the disposable Q80/A80 atlases afterward. Neither source photographs nor star-removal dependencies are required for replay.

The particles constrain emissivity under the documented expansion model; colors, finite smoothing and diffuse-component depths retain the original conditional interpretation. These are not measured gas mass densities.

To change registration, fit settings, or source imagery, use the original research pipeline and export a new compact package. Replay refuses outputs that disagree with the retained geometry/resource hashes.
