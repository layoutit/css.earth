# Triton

Triton is shown with a Monochrome mosaic of controlled Voyager 2 frames, two LPI global color maps, and a Voyager color dataset built here from Voyager 2 frames. Triton has a thin nitrogen atmosphere; these observations do not justify a visible halo or an elevation dataset inferred from brightness.

The [navigation marker](source/preparation/navigation.json) keeps its source-map crop with the shared full-phase curvature shading (35% ambient, 65% diffuse). It is a stylized identifier, not illumination at the scene epoch.

## Sources

- Michael Bland / USGS, [High Resolution Voyager 2 Images of Neptune’s Moon Triton](https://doi.org/10.5066/P9MGH7FB), 2023 processing of 1989 Voyager images. We use the CLEAR-filter frames in `fully_processed.zip`, at approximately 335–1633 m/pixel. USGS removed reseaux and corner marks with local interpolation.
- Paul Schenk / LPI's [2014 global color map](https://www.lpi.usra.edu/icy_moons/neptune/triton/), `tnmap-cyl-KH.jpg`, 14,138 × 7,069, approximately 600 m/pixel at the equator. Orange/green/blue filter images approximate natural color with enhanced contrast. NASA/JPL supplied Voyager images; credit Paul Schenk, Lunar and Planetary Institute. Public use is permitted with that credit.
- Paul Schenk / LPI's [2021 orange/blue/ultraviolet global mosaic](https://repository.hou.usra.edu/items/bcb44bc8-5140-48eb-b561-12326d7bb6e7) (Schenk et al. 2021, *Remote Sensing* 13:3476), `tnmap-cyl-KH-obu.jpg`, 14,165 × 7,083, is the Ultraviolet color dataset: orange, blue and ultraviolet shown as red, green and blue, declared false color. The JPEG is mirrored byte for byte on R2 because the repository challenges scripted requests. Credit Paul Schenk / LPI / USRA and NASA/JPL Voyager 2.
- The Voyager color dataset uses twelve green, violet and ultraviolet frames near closest approach (c1139257–c1139323, 1.44–1.62 km/pixel) from Bland's release, plus fifteen approach frames at 4.0–25 km/pixel (five triplets: c1138657/703/715, c1137715/721/727, c1137159/221/245, c1133848/859/923 and c1132134/141/400) as PDS Ring-Moon Systems Node GEOMED products from volume VGISS_8207.
- The camera comes from a pinned [Voyager 2 Neptune kernel bank](../../spice/voyager/manifest.json); Sun and observer positions from JPL Horizons.
- Named features come from the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile (retrieved 2026-09-11, public domain per its FGDC metadata). Seven labelled names carry a caption note from the lead of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption beside the IAU naming year.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

**Monochrome.** The TIFFs and ISIS metadata give an orthographic centre at 15° east, 18° north; the release prose says 15° west, but the embedded grid controls the pixels. Each calibrated frame is corrected before composition with the Lunar-Lambert function (weight 0.5, 30° incidence / 0° emission reference). Finer valid observations replace coarser ones, with one bounded exposure multiplier per frame (0.67–1.5). The display transfer is I/F divided by 0.9 with gamma 1.4. The preparation grid is 14,336 × 7,168, approximately 593 m equatorial texels.

**LPI color maps.** The unannotated map runs from 180° W to 180° E and is rolled to the shared 0–360° east-positive convention. Voyager did not illuminate the black northern region; exact black is withheld before resampling. Neither color nor Monochrome fills the other's gaps.

**Voyager color.** No reconstructed pointing exists for the Neptune encounter, so the SEDR pointing is corrected by fitting the sunlit limb as one circle. The [placement report](source/reference/voyager-color-placement.json) records the fits. A datum shift of 0.78°, −0.80° lands the frames on the Monochrome dataset's controlled grid. Each triplet is corrected with the same Lunar-Lambert function and used only within 60° incidence and emission.

The two calibrations disagree: Bland's `voycal` I/F is darker than GEOMED by a different factor per band (green 1.35, violet 1.19, ultraviolet 1.28). The GEOMED values reproduce Nelson et al. (1990, *GRL* 17:1761) disc-integrated color: green ÷ violet 1.21 here against their 0.81 ÷ 0.68 = 1.19, while the Bland frames give 1.06. So the 4.7 km/pixel triplet is the level reference and other observations are scaled onto it band by band. Where Bland's frames view their ground beyond 60° emission, the 4.7 km triplet owns those texels. [The color preparation guide](../../../docs/color-preparation.md#current-routes-and-scope-of-the-repair) documents both policies.

The sphere uses the 1,352.6 km mean radius with synchronous retrograde rotation. The prepared map starts at 0° E; preparation refuses a declared edge the source contradicts ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)).

## Evidence

Read through its georeferenced source, the prepared enhanced map correlates 0.96 from 0° E and 0.62 from 180° E.

The limb fits removed SEDR errors of 49–256 pixels; every accepted fit has at least 80 edge points and an RMS below 1.3 pixels. The [oracle report](source/reference/voyager-color-oracle.json) places Bland's own color frames the same way and compares them with his orthophotos. Nine of twelve give a clean limb. Their residuals run 19–30 km, a constant offset with an RMS scatter of 5 km between frames. Bland et al. state their absolute alignment as about one degree, so the offset is within their uncertainty.

## Known problems

- The Voyager color dataset is false color (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles, 39°–62° for the Bland set and wider for the approach frames. A color seam at a footprint edge is a real difference in viewing geometry. The limb-placed frames carry the release's roughly one-degree alignment plus the 2–4 km scatter of our fit. The brightest 0.1 % of texels may clip.
- The per-frame Lunar-Lambert correction reduces acquisition shading; it is not a calibrated albedo map. Local terrain shading, resolution changes and some patch transitions remain. No phase, atmosphere-scattering or terrain-shadow inversion is claimed.
- The Gazetteer export gives a diameter for only 4 of Triton's 63 adopted names (the four craters), so only those four are labelled until the export carries sizes. Outlines are not published nomenclature boundaries.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
