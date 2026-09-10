# Automatic star removal

The image sidebar uses NOX for imported image candidates. Choose an image, optionally inspect **Quick preview**, then choose **Remove stars**. Clicking either processing button selects that image for that operation; merely browsing the catalogue runs no inference. No pre-existing star layers, source-specific trial recipe, star examples, calibration, width fitting or separate sidebar tab are required. The original, completed starless image and positive residual remain available through the three comparison buttons. Removal strength defaults to 100%.

Quick preview selects native crops automatically and leaves the full image unchanged. Full removal uses overlapping 512px inference tiles, bounded batches and blended interiors. It saves source-sized lossless diffuse/residual/mask files and smaller prepared display textures. Model evaluation happens in the local Python worker; the browser only displays prepared images.

Refresh reconnects to the same server-owned full-image job. Cancel explicitly terminates it. A server restart marks unfinished work interrupted. Completed results are source/model/code pinned and restore without running inference again. Model or source changes invalidate old cache entries. Earlier manual-sampling records remain in the ignored cache for provenance but are not loaded by the new UI.

## Model and dependencies

[NOX](https://github.com/charvey2718/nox) is an automatic convolutional encoder–decoder for astrophotographs. The author licenses code and trained weights under MIT. This implementation uses the frozen RGB model from [v1.1.0](https://github.com/charvey2718/nox/releases/tag/v1.1.0), with RGB normalization to [-1,1] and output conversion back to [0,1]. It does not apply an additional photographic stretch.

The local model is `.local/open-star-removal/noxGeneratorColor.pb`, SHA-256 `d54bdca728d1d6db0b3eef41d4187d327909d1ec5cd2a71485bfa9d7924ba546`. The worker environment is `.local/open-star-removal/venv/bin/python`, with TensorFlow 2.16.2, NumPy 1.26.4 and OpenCV headless 4.11.0.86. The model and environment stay outside Git, alongside the existing approved scientific source cache.

Every candidate resolves to its downloaded, hash-pinned original and matching full-extent preview. NOX works on the native pixel grid; non-RGB8 originals, including the 16-bit SMASH TIFF, receive a separate full-size RGB8 working PNG without an additional stretch. Its hash is the processing source identity; the original path/hash remain bound into the cache identity. Original bytes are never replaced. Missing originals and unsupported raster inputs report the actual reason.

The earlier VISTA, Horálek and WISE recipes retain their existing source/alignment checks and optional diffuse baseline so completed results restore unchanged. Other candidates need no trial-plan entry or alignment gate to remove stars. Image-to-density registration and approval remain requirements of subsequent 3D baking, which these buttons never trigger.

## Interpretation

The model predicts a plausible background beneath stars; it does not measure the hidden nebula. The mask shows actual removed signal, not a catalog of identified stellar objects. Inspect compact nebular detail, saturated cores and halos before deciding on a 3D bake. Native integer accounting remains exact: original = without stars + residual. Pixels outside the mask remain unchanged. The current reconstructed volume is not rebuilt by star removal.
