# Ariel

Ariel, a moon of Uranus, shows a Voyager 2 mosaic, a terrain model and a Voyager color composite. The northern region Voyager did not see is left as a gray grid.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- **Monochrome and Elevation:** Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images and revised cartographic control, documented in the [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download). The files are `aumap-cyl-180180.cub` and `audem-ZTL-cyl-180180.cub`, 3652 × 1826 ISIS3 cubes at 1000 m pixels. The release author recommends contacting him before scientific analyses or proposal use.
- **Voyager color:** Voyager 2 ISS narrow-angle GEOMED frames from the PDS Ring-Moon Systems Node (volumes VGISS_7201–7207, inventoried through the OPUS API): every complete green/violet/ultraviolet set of Ariel, 21 frames in 7 sets, listed in [the frame recipe](source/preparation/voyager-color-frames.json). The camera comes from the [Voyager 2 Uranus kernel bank](../../spice/voyager/manifest.json); Sun and observer positions are JPL Horizons vectors.
- **Color calibration:** Bell and McCord (1991, *Proc. Lunar Planet. Sci.* 21, 473–489; [ADS 1991LPSC...21..473B](https://ui.adsabs.harvard.edu/abs/1991LPSC...21..473B)).
- **Facts and frame:** JPL satellite elements and IAU/NAIF rotation from the vendored astronomy package, and [NASA's Ariel overview](https://science.nasa.gov/uranus/moons/ariel/).
- **Named features:** the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile (retrieved 2026-09-11, public domain), pinned under `source/features/`. Five names carry the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), in `source/features/notes.json`.

## Processing

**Monochrome.** [Schenk and Moore (2020)](https://doi.org/10.1098/rsta.2020.0102) describe lunar-Lambert normalization of the best-resolved images; the result approximates normal reflectance and is not a true albedo map. The best mosaic has about 1 km samples, with two smeared terminator images replaced by desmeared versions from Stryk and Stooke. Preparation applies one linear 0–3000 DN display stretch; source values span about −895 to 8699 DN, so bright outliers clip.

**Elevation.** The DEM merges stereo, photoclinometry and limb profiles, in kilometres above the published reference ellipsoid, from about −7.024 to +5.796 km. The display scale runs −8 to +6 km, with northwest relief shading and no exaggeration. Colors do not displace the geometry.

**Globe.** Both maps are registered from their ISIS labels onto the shared raster lane's 578.9 km sphere of 450 leaves, with Lambert lighting and no atmosphere. ISIS special pixels become the shared neutral grid. The map starts at 0° E, and preparation refuses a declared map edge the source contradicts ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)).

**Voyager color placement.** [`author-color-frames.mts`](../../../packages/bake/authoring/voyager-iss/author-color-frames.mts) predicts each disc from the SEDR pointing, fits the limb as one circle and shifts the optical centre (fit RMS 0.37–1.17 pixels). Each frame is then registered against the Schenk mosaic rendered through its own camera, and a band that does not register is dropped rather than fringed. 9 frames in 3 sets were placed ([placement report](source/reference/voyager-color-placement.json)): set-19860124-1438 (1.3 km/px), set-19860123-0140 (17.7 km/px) and set-19860122-2015 (19.8 km/px).

**Voyager color levels.** Each set gets the mosaic's lunar-Lambert correction and is levelled band by band onto set-19860124-1438. The archive's filter calibration leaves violet darker than green and ultraviolet (violet/green 0.873, ultraviolet/green 0.972), which renders purple. Bell and McCord recalibrated the filters against ground-based spectra; read from their Fig. 2 at ±0.02, Ariel has ultraviolet/green 1.05 and violet/green 1.0. The composer scales violet and ultraviolet by one gain each (1.145, 1.081) to meet those ratios; spatial color differences are Voyager's own. The dataset takes one brightness gain against the monochrome base, and the brightest 0.1 % of texels may clip.

## Evidence

- Map edge: read through its georeferenced source, the prepared map correlates 0.91 from 0° E and 0.14 from 180° E.
- Color oracle: re-placing every frame and correlating its detail against the mosaic gives a mean correlation of 0.39 and a mean residual of 25.1 km over 9 frames ([report](source/reference/voyager-color-oracle.json)).
- The color ordering agrees with Karkoschka (2001, *Icarus* 151, 51), who finds the moons gray with a slightly red slope, and DeColibus et al. (2026, *Planet. Sci. J.*, [doi:10.3847/PSJ/ae4a1b](https://doi.org/10.3847/PSJ/ae4a1b)), who measure V/B of 1.03–1.05.

## Known problems

- The Voyager color dataset is false color (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles, so a color seam at a footprint edge is a real difference in viewing geometry. Its band ratios come from a figure read at ±0.02, and the ultraviolet calibration carries a stated ±10 % uncertainty. 12 of the 21 frames could not be placed.
- The mosaic keeps cast shadows, camera marks, seams and unequal local resolution. No additional photometric recovery is claimed.
- The DEM has image-derived errors, smoother lower-resolution patches, and sparse curved limb-profile tracks outside the denser coverage. The tracks are real samples and are not filled around.
- The unseen north is not reconstructed, mirrored or filled. Faint Uranus-shine observations of northern terrain are not treated as mapped coverage.
- Feature outlines are not published nomenclature boundaries.
- The navigation marker is a crop of observed southern terrain, not a full-disc observation. The 84-second rotation is a display choice.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
