# VLT/MUSE spectral surface observations

Original measured maps: Oliver King (2024), released as [v0.1.0](https://doi.org/10.5281/zenodo.11402374),
with explicit [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) terms in
`datacite-license.json`. [King et al. (2025)](https://doi.org/10.1029/2024JE008511)
describes the observations and interpretation. Data were acquired with VLT/MUSE
in July 2019, ESO programme 0103.C-0769(A). Exact original FITS files, immutable
GitHub blob identities and the release commit appear in `source-qualification.json`.

## Source and coordinate interpretation

The FITS contains 180×90 float64 samples with NaN gaps. It has no WCS, dates,
units or uncertainty cards. Pinned filenames and the paper establish identity
and quantity. The author's [mapping convention](https://github.com/ortk95/astro-tools/blob/040ecca96f4e05cf7ab965e36fb1785229f6ebf7/tools/mapping.py#L413-L414)
uses integer coordinate nodes. Independent published numerical landmarks and
observation footprints corroborate longitude orientation and latitude order.
The qualification record retains alternative offset candidates and rejected
mirror/180-degree interpretations. The mapping code is not explicitly bound to
the FITS release: absolute subpixel registration remains unresolved. Two degrees
is the sampling interval, not a measured astrometric error bound or the
instrument's effective spatial resolution.

Our explicit interpretation places columns at 0, 2, …, 358 degrees east and rows
at −90, −88, …, 88 degrees north. Conversion only reverses rows, rolls longitude
and rounds to float32. The TIFF central meridian is −1 degree so the circular
seam lies on a pixel edge. Nearest sampling preserves nodes; physical out-of-range
latitudes and no-data remain missing. A one-native-node validity-edge buffer is
withheld without inspecting brightness. This is a conservative support choice,
not a pointing correction. No spectral fitting or smoothing occurs in cssEarth.

## Coverage, seams and display

The three nights remain separate TIFFs. The normal scientific preparer takes
night 1 where valid, then night 2, then night 3. This is an explicit coverage
priority; it neither averages repeated measurements nor ranks their quality.
The paper's photometric correction is retained, including residual differences.
Receipts quantify overlap differences. Seams are observations from different
nights, not established chemical boundaries. Gray grid marks missing and withheld
samples. The fixed display intervals encompass all original finite values.

Each view uses an existing dataset control, legend, minimap and surface material.
Textures use one eighth of the body's photographic texture dimensions. Runtime
receives only prepared images and metadata, and keeps the existing geometry,
retained tree, shared camera and interaction policy.

## Ganymede measurement

Oxygen signature is the released 565/577.3 nm reflectance ratio. Although the
source filename contains `band`, its values are ratios, not literal band depths.
Display range: 0.98–1.02. The feature is associated with molecular oxygen in
surface ice; it does not measure oxygen abundance or atmospheric density.
The adjacent adaptive-optics spectral gap limits the continuum estimate, and
spectral slope/curvature can affect contrasts. Values below one remain valid
source measurements. Median absolute cross-night differences are 0.00185–0.00321;
the largest pairwise 95th percentile is about 0.00944. Those differences can be
material relative to the spectral contrast and are not calibrated error bars.

## Reproduction

With NumPy and Rasterio available, from the repository root:

```sh
python3 tools/objects/acquisition/muse-spectral-maps.py src/objects/ganymede/source/muse/ganymede-recipe.json
```

Original inputs and derived TIFFs are retained with exact manifest pins. The
conversion receipt records numerical, mask and overlap checks.
