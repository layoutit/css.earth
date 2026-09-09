# Callisto: Galileo processed color

The body-owned source implementation adds `enhanced`, labeled **Galileo color**,
using the official [USGS PIA03456 PNG](https://www.usgs.gov/media/images/callisto-galileo-ssi-color-mosaic).
It adds a real partial photographic color view while retaining the existing
monochrome mosaic, sphere, current scene epoch and generic renderer. The
[NASA/JPL/DLR release](https://science.nasa.gov/photojournal/global-callisto-in-color/)
dates the picture to May 2001 and the release to August 22, 2001.

The six fixed perspective parameters and original inputs are pinned in
`src/planets/callisto/source/validation/galileo-color-registration.json`.
Two image quadrants were fitted and two withheld. An independent unblurred
comparison to the native controlled GeoTIFF and eight named Gazetteer landmarks
passed without camera refitting. Reference brightness is never used to fill
or recolor the source plate. Local diagnostic offsets are not a claim of
absolute geodetic accuracy.

The source-only converter is
`src/planets/callisto/source/preparation/prepare-galileo-color.py`; its pinned
recipe emits a 1440×720 RGBA GeoTIFF and conversion proof. An emission cutoff
of 65° plus fully opaque original contributors retains 28.735% of the sphere.
The shared gray grid marks everything else. This is processed display color,
not I/F, reflectance ratios or measured albedo. Source detail is about 8km
per pixel near the center and worse toward the edge; the larger display atlas
adds no scientific resolution. Selecting the lens faces 145.2°E,−0.15°N.

Four focused source tests pass. They check every derived texel against the
original plate, independent landmark coordinates, the complete source/pin chain
and the actual shared GeoTIFF decoder. Isolated source reproduction produced
the identical compressed TIFF; a corrupted input pin rejected before writing.
Exact evidence hashes and commands are in the companion JSON. Body preparation,
actual retained-atlas tests and integrated browser qualification remain pending.

The source manifest’s stale pre-existing content pin was corrected alongside
the authored content update. Runtime tests now target the delivered atlas rather
than a noncanonical intermediate map. No shared code, registry entry or
remote publication was changed in this lane.
