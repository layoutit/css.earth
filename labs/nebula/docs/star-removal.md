# Automatic star removal

The image sidebar uses NOX for imported image candidates. Choose an image, optionally inspect **Quick preview**, then choose **Remove stars**. Clicking either processing button selects that image for that operation; merely browsing the catalogue runs no inference. No pre-existing star layers, source-specific trial recipe, star examples, calibration, width fitting or separate sidebar tab are required. The original, completed starless image and positive residual remain available through the three comparison buttons. Removal strength defaults to 100%.

Quick preview selects native crops automatically and leaves the full image unchanged. Full removal uses overlapping 512px inference tiles, bounded batches and blended interiors. It saves source-sized lossless diffuse/residual/mask files and smaller prepared display textures. Model evaluation happens in the local Python worker; the browser only displays prepared images.

Refresh reconnects to the same server-owned full-image job. Cancel explicitly terminates it. A server restart marks unfinished work interrupted. Completed results are source/model/code pinned and restore without running inference again. Model or source changes invalidate old cache entries. Earlier manual-sampling records remain in the ignored cache for provenance but are not loaded by the new UI.

## Model and dependencies

[NOX](https://github.com/charvey2718/nox) is an automatic convolutional encoder–decoder for astrophotographs. The author licenses code and trained weights under MIT. This implementation uses the frozen RGB model from [v1.1.0](https://github.com/charvey2718/nox/releases/tag/v1.1.0), with RGB normalization to [-1,1] and output conversion back to [0,1]. It does not apply an additional photographic stretch.

The local model is `.local/open-star-removal/noxGeneratorColor.pb`. The worker environment is `.local/open-star-removal/venv/bin/python`, with TensorFlow 2.16.2, NumPy 1.26.4 and OpenCV headless 4.11.0.86. The model and environment stay outside Git, alongside the existing approved scientific source cache.

Every candidate resolves to its downloaded, recorded original and matching full-extent preview. NOX works on the native pixel grid; non-RGB8 originals, including the 16-bit SMASH TIFF, receive a separate full-size RGB8 working PNG without an additional stretch. Its hash is the processing source identity; the original path/hash remain bound into the cache identity. Original bytes are never replaced. Missing originals and unsupported raster inputs report the actual reason.

The earlier VISTA, Horálek and WISE recipes retain their existing source/alignment checks and optional diffuse baseline so completed results restore unchanged. Other candidates need no trial-plan entry or alignment gate to remove stars. Image-to-density registration and approval remain requirements of subsequent 3D baking, which these buttons never trigger.

## A picture for the application: `remove-stars`

`node labs/nebula/run.mts remove-stars <object-directory> [--from=<file>] [--coarse=<factor>] [--star-red-over-blue=<ratio>] [--star-green-over-blue=<ratio>] [--star-most-pixels=<count>] [--spike-lines=<count>]` makes the star-free copy
of an image-layer bank's picture
([remove-stars.ts](../packages/lab/src/cli/commands/remove-stars.ts)). It reads the bank's `source/recipe.json`, takes the
download the recipe names into the ignored cache (`.local/nebula-lab/starless/<id>/`), runs NOX over it and writes the
result as the bank's picture, `source/<source.path>`. The bank's manifest names this command as that file's generator,
and the file is mirrored in the source cache, so a checkout restores it without running NOX. With `--from=<file>` it
takes a picture another generator wrote into the bank's `source/` directory in place of the download: M20's picture is a
window cut from the publisher's file.

NOX takes a star's core and spikes but leaves the wide glow of a bright one. For each star of the recipe's
`source.foregroundStars` table brighter than Gaia G = 14, [haloes.ts](../packages/reconstruction/src/star-removal/haloes.ts)
measures the glow on the picture and fills it from the ring around it: each ring's median, over the half that faces away
from the target, until no channel still falls by 1.5 levels over the next 12 px; then an inverse-square blend of 64 ring
samples. The constants are presentation choices made on M66's Sloan picture. The isophote fill of the emission recipes
suits an elliptical; on a spiral it left a dark notch.

NOX takes a star whose core is a few pixels wide. A saturated star tens of pixels wide stays, with its spikes. With
`--coarse=<factor>` NOX runs again over a copy of the star-free picture that many times smaller, where such a star is small
enough, and [coarse.ts](../packages/reconstruction/src/star-removal/coarse.ts) gives the picture that pass's result only
where it took a star: a connected patch of small pixels that each lost more than 6 levels and holds one that lost 40 or
more. The rest of the picture keeps its own pixels. The constants are presentation choices made on M16's ESO picture at a
quarter of its size. The small pass also takes compact bright nebula: on M17, M27, M43, M57 and M78 it took real gas, so
those banks run one pass. The glow fill above is for a galaxy; on a nebula it erased the gas around the stars that light it.

NOX takes compact bright light, and a supernova remnant's ejecta are compact bright knots: over Cassiopeia A's Webb picture
it took the knots with the stars. With `--star-red-over-blue=<ratio>`
[star-color.ts](../packages/reconstruction/src/star-removal/star-color.ts) reads the light NOX took by its color and gives the
picture its own pixels back where that light is not a star's: a connected patch of pixels that each lost more than 6 levels
is a star where its lost red is at most the ratio times its lost blue, and in any other patch a pixel is still a star's
where the light lost within 2 px of it is that color. In Cassiopeia A's picture (1.62, 3.56 and 4.44 µm as blue, green and
red) a star is blue and the ejecta red: the lost light, by its patches' red over blue, peaks between 0.25 and 0.5, is lowest
near 0.8 and tails off above 1, so that bank passes 0.8. The constants are presentation choices made on that picture. The
small pass there replaced 8% of the picture with soft light and left the bright stars' spikes, so the bank runs one pass.

At mid infrared a star is bluest and the remnant's knots run from red through white to green, so red alone takes the
green ones. `--star-green-over-blue=<ratio>` also asks a star's lost light to be no greener than that ratio of its blue,
and `--star-most-pixels=<count>` reads a patch larger than that pixel by pixel instead of as one star: over the bright
ring NOX's patches join knots over thousands of pixels. Cassiopeia A's MIRI bank passes 0.35, 0.8 and 5,000
([its README](../../../src/objects/cassiopeia-a-miri-layers/README.md) has the measurements).

NOX leaves a saturated star in a Webb picture with its diffraction spikes, which run hundreds of pixels across it. With
`--spike-lines=<count>` (and `--star-red-over-blue`) [spikes.ts](../packages/reconstruction/src/star-removal/spikes.ts)
takes those stars out: a star is a saturated place of the picture before NOX whose light runs out along the spikes'
lines, which are measured on the picture's brightest stars. Each spike loses, across its band, no more than the running
median of its own height above its flanks, so a filament it crosses keeps its light; the core and its glow lose the
light that stands round the star alike in every direction, and NOX's hollowed core is given back. Cassiopeia A passes 4
(six bright spikes on three lines and two faint ones on a fourth).

Tests: `node labs/nebula/run.mts test haloes`, `node labs/nebula/run.mts test coarse` and `node labs/nebula/run.mts test star-color`.

## Interpretation

The model predicts a plausible background beneath stars; it does not measure the hidden nebula. The mask shows actual removed signal, not a catalog of identified stellar objects. Inspect compact nebular detail, saturated cores and halos before deciding on a 3D bake. Native integer accounting remains exact: original = without stars + residual. Pixels outside the mask remain unchanged. The current reconstructed volume is not rebuilt by star removal.
