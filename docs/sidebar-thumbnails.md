# Sidebar thumbnails

Galaxy and nebula object rows use the default dataset's own image. Dataset rows
use their selected dataset's image. The shared sidebar displays prepared 32 px
WebPs at 14 or 16 CSS pixels; it does not download a full preview just for an icon.

Run `node site/build/prepare/prepare-sidebar-thumbnails.mts` after restoring the runtime assets or
changing a prepared dataset preview. Run it with `--check` to reproduce every
thumbnail in memory and compare its bytes with the committed files.

The preparer reads each object's `prepared/presentation.json`, checks that each
dataset names its preview `datasets/<dataset id>.webp`, and fits the complete image inside 16 and 32 px squares.
It preserves the image's aspect ratio and published display colors, with transparent
padding. The Milky Way icon composites the existing prepared z slabs face-on,
including their offsets and alpha; it is a view of the OpenSpace-derived model.

The [prepared receipt](../public/navigation/sidebar-thumbnails.json) records every
input path and byte count, source credit and image URL. Original datasets and repaired
runtime assets are read-only inputs. The preparer writes only its sidebar images
and receipt under `public/navigation/`.

Catalogue-only galaxies and clusters without prepared imagery keep the ordinary
circle marker. Their catalogue identity does not imply a photographic dataset.
