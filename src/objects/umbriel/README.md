# Umbriel

Umbriel is shown with Voyager 2's monochrome mosaic, a Voyager false-color dataset and IAU feature names, on a 584.7 km sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Monochrome uses Paul Schenk’s [2020 LPI Uranian satellites release](https://repository.hou.usra.edu/handle/20.500.11753/1687), original `uumap-cyl-180180.cub`, a 919 × 460 floating-point mosaic on a 4,000 m grid. The source README is retained alongside it.

The Voyager color dataset uses Voyager 2 ISS narrow-angle GEOMED frames from the PDS Ring-Moon Systems Node (volumes VGISS_7201–7207, inventoried through the OPUS API): every complete green/violet/ultraviolet set of Umbriel the archive holds, 24 frames in 8 sets, listed in [the frame recipe](source/preparation/voyager-color-frames.json). The camera comes from the pinned [Voyager 2 Uranus kernel bank](../../spice/voyager/manifest.json); observer and Sun positions are JPL Horizons vectors. The band ratios are tied to Bell and McCord (1991, *Proc. Lunar Planet. Sci.* 21, 473–489; [ADS 1991LPSC...21..473B](https://ui.adsabs.harvard.edu/abs/1991LPSC...21..473B)).

Named features come from the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile (retrieved 2026-09-11, public domain). Four names carry the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), pinned in `source/features/notes.json` and credited in the caption.

[NASA’s Umbriel overview](https://science.nasa.gov/uranus/moons/umbriel/) supports the cratered appearance, bright Wunda region and Lassell’s 1851 discovery. Radius, synchronous rotation and orbital placement come from the vendored JPL/IAU astronomy records.

## Processing

The mosaic feeds the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto, with a Lambert lighting bank and no atmosphere. A display stretch of 0–1950 source DN keeps the bright Wunda ring’s tonal structure; it is not a physical reflectance scale. Only ISIS special pixels are missing; they show as the neutral grid.

For the color dataset, [`author-color-frames.mts`](../../../packages/bake/authoring/voyager-iss/author-color-frames.mts) fits each frame's limb and registers it against the Schenk mosaic seen through its own camera. A set with a band that does not register is dropped rather than fringed. Each triplet is corrected with the same Lunar-Lambert disk function as the monochrome mosaic, to incidence 30° and emission 0°. The archive's calibration leaves violet darker than green, which renders purple, so the violet and ultraviolet bands take one gain each (1.055, 1.020) to meet Bell and McCord's whole-disc ratios (ultraviolet/green 1.03, violet/green 1.0). Spatial color differences are Voyager's own.

## Evidence

- The prepared normal map correlates 0.87 against its georeferenced source from 0° E and −0.10 from 180° E, so the map starts at 0° E ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)).
- Of 24 color frames, 3 frames in 1 set were placed (set-19860123-0121, 16.9 km/px). Limb fits have an RMS of 0.39–1.14 pixels. See [the placement report](source/reference/voyager-color-placement.json).
- The [oracle report](source/reference/voyager-color-oracle.json) compares 3 frames against the mosaic: mean correlation 0.21, mean residual 209.0 km.
- The color ordering agrees with Karkoschka (2001, *Icarus* 151, 51), who finds the moons gray with a slightly red slope, and DeColibus et al. (2026, *Planet. Sci. J.*, [doi:10.3847/PSJ/ae4a1b](https://doi.org/10.3847/PSJ/ae4a1b)).

## Known problems

- The mosaic is source-normalized imagery, not calibrated albedo. Resolution varies, and acquisition shadows and processing seams can remain.
- The Voyager color dataset is false color (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles. A color seam at a footprint edge is a real difference in viewing geometry. Bell and McCord's ratios are read from a figure at ±0.02, and their ultraviolet calibration carries a stated ±10 % uncertainty.
- The separate limb-profile product uses an older control network displaced by degrees and does not provide continuous elevation coverage.
- The spherical scene is a display approximation, not a measured shape mesh. Nomenclature outlines are not published boundaries.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
