# Partial Cassini VIMS spectral views

The [Nantes VIMS data policy](https://vims.univ-nantes.fr/about)
explicitly releases the selected calibrated C cubes and navigation N cubes under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit: NASA /
Caltech-JPL / University of Arizona / Osuna-CNRS-Nantes Université. Original
C/N bytes, native PDS labels, source-page terms and processing documentation
accompany the numerical maps. `source-receipt.json` records original URLs and
hashes. `prepare.json` binds every input used by the offline converter.

## What the colors measure

- Ice absorption: `1 - R70 / Rc`, with a linear continuum between native channels
  58 and 81, weighted by each cube's own wavelength table. These channels are
  near 1.82, 2.02 and 2.20 µm. This is our fixed-channel application of the
  [continuum-relative band-depth definition](https://pubs.usgs.gov/of/2003/ofr-03-128/ofr-03-128.html),
  not a released ice abundance solution. Display interval: 0.55–0.81.
- Infrared ratio: `median(R134, R135, R136) / R48`, near 3.1 / 1.66 µm. The
  three-channel median follows the [Robidel et al. spectral mapping method](https://arxiv.org/html/2006.00146).
  Display interval: 0.01–0.10. These native wavelengths drift between observations;
  exact values appear in the receipt. This is not an inferred temperature,
  crystallinity percentage, grain diameter or terrain age.

The archive's [RC19 calibration, noise filtering and local lowpass replacement](https://vims.univ-nantes.fr/info/isis-calibration)
are retained. We do not apply photometric correction. Incidence, emergence,
phase, noise and grain size can affect spatial differences. This six-observation
coverage product does not reproduce the authors' corrected global mosaic. The
[Robidel corrigendum](https://doi.org/10.1016/j.icarus.2020.113954) corrects a
180-degree longitude-label error in original Figures 9 and 11; our geometry
comes from the matched native navigation backplanes, not those figure labels.

## Geometry, support and missing data

The six C/N pairs are listed in the recipe, spanning 2005 and 2011. Their native
planetocentric east-positive navigation centers define interior spherical
four-center cells. Samples pass explicit incidence/emergence, phase and native
resolution cuts. A center's four diagonal neighbors predict its direction,
while separate axis neighbors define the local sample/line scale. Centers with
prediction errors above 0.25 native pixels or without a held-out estimate are
withheld. This checks local transfer consistency; it does not establish absolute
spacecraft pointing or image registration to the existing ISS surface.

Every accepted output cell takes the exact index of its nearest supported native
vertex. No spectral value is spatially averaged. Overlap priority is native
resolution, then emission, then fixed recipe observation order and cell order.
Invalid vertices invalidate their full center cell; there is no extrapolation
past the support boundary. The separate observation/source-pixel audit TIFFs
identify the original owner of every mapped value and are not runtime views.

The 1024×512 TIFF is a display grid. It does not claim that instrument resolution.
Supported union area is estimated at 23.7741% of a reference sphere. The
252.1 km projection radius normalizes angles; it adds no height to the existing
252.1 km scene. The current shape/terrain, camera, retained tree and imagery stay
fixed. Gray grid marks every unsupported sample. Missing ISIS specials and
invalid denominators are withheld; finite zero or negative source noise is not
silently treated as missing. Both published display ranges contain all retained
finite values.

## Reproduction

With NumPy and Rasterio available, from the repository root:

```sh
python3 tools/objects/acquisition/enceladus-vims-spectral.py src/objects/enceladus/source/vims-chemistry/prepare.json
```

The source manifest pins original and derived bytes. The ordinary scientific
raster preparer samples these maps with nearest-neighbor selection, prepares the
existing material atlases, legends and minimaps, and passes only prepared assets
to runtime. Scientific textures use one eighth of this body's photographic
texture dimensions. This does not change the retained geometry or renderer.
