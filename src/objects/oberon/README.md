# Oberon

Oberon is shown as a mean-radius sphere with a Voyager 2 monochrome mosaic and a Voyager false-colour dataset.

## Sources

Oberon's Monochrome view uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images registered with updated control networks. The selected product is [`oumap-cyl-180180.cub`](https://repository.hou.usra.edu/bitstreams/33526bf8-69e4-4246-b995-0b238a8b31d0/download). The release's [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) documents the release.

The Voyager color dataset uses Voyager 2 ISS narrow-angle GEOMED frames from the PDS Ring-Moon Systems Node (volumes VGISS_7201–7207): every complete green/violet/ultraviolet set of Oberon that the archive holds, 18 frames in 6 sets, listed in [the frame recipe](source/preparation/voyager-color-frames.json). The camera comes from the [Voyager 2 Uranus kernel bank](../../spice/voyager/manifest.json): the `ura111` satellite ephemeris, the `vgr2.ura111` trajectory and the Ring-Moon Systems Node SEDR pointing C-kernel. Observer and Sun positions are JPL Horizons vectors at each frame's exposure time. The band ratios are tied to Bell and McCord (1991, *Proc. Lunar Planet. Sci.* 21, 473–489; [ADS 1991LPSC...21..473B](https://ui.adsabs.harvard.edu/abs/1991LPSC...21..473B)).

Named features come from the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Oberon (public domain per its FGDC metadata), kept under `source/features/`. 2 labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0), kept with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year. [NASA's overview](https://science.nasa.gov/uranus/moons/oberon/) and the Voyager image caption supply editorial facts. Physical and orbital values use the vendored astronomy package: a 761.4 km mean radius, about 583,500 km orbital semimajor axis, synchronous rotation and an approximately 13.46-day orbit.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

**Monochrome.** The cube contains 957 × 479 Real/Lsb samples with 5,000 m pixels, simple cylindrical, planetocentric and positive-east. The `CLEAR` band label gives a 0.46 μm center and 0.36 μm width. Native sampling is approximately 2.658 pixels per degree; effective detail varies across contributing observations. The cube history records `photomet` on 2020-02-18 with maximum emission 81° and maximum incidence 89.7°, followed by high/low-pass mosaic combination and map reprojection. No additional photometric model is invented here. Display DN 0–2100 maps linearly to 0–255, encompassing the original valid range of approximately 54.09–2084.88. ISIS special pixels remain missing; the gray grid identifies real gaps, including unobserved northern regions, which are not filled by mirroring or extrapolation.

**Voyager color.** The SEDR pointing predicts the disc; the limb is fitted as one circle and the optical centre moves by the fitted offset. The SEDR errors removed were 79–80 pixels and the accepted fits have an RMS of 0.49–0.99 pixels. Each frame is then registered against the Schenk 2020 mosaic rendered through its own camera; a set stands on the frame that registered best and its other bands register to that anchor, so a band that does not register is dropped rather than fringed. 3 frames in 1 set were placed: set-19860122-1731 (21.7 km/px). Of the 15 not placed, the limb fit rejected 6 and 9 had no frame that registered against the mosaic. The [placement report](source/reference/voyager-color-placement.json) has the details.

Each set is corrected with the same Lunar-Lambert disk function as the monochrome mosaic to incidence 30°, emission 0°, used within 60° of both. The archive's filter calibration leaves violet darker than both green and ultraviolet (Oberon: violet/green 0.870, ultraviolet/green 0.921), which renders purple. Bell and McCord (1991) recalibrated the filters against ground-based spectra; read from their Fig. 2 at ±0.02, Oberon has ultraviolet/green 0.915 and violet/green 0.935. The composer scales the violet and ultraviolet bands by one gain each (1.075, 0.993) to meet those ratios; spatial colour differences are Voyager's own. The ordering agrees with Karkoschka (2001, *Icarus* 151, 51) and DeColibus et al. (2026, *Planet. Sci. J.*, [doi:10.3847/PSJ/ae4a1b](https://doi.org/10.3847/PSJ/ae4a1b)), who measure V/B of 1.03–1.05 with Oberon and Titania the reddest. The dataset takes one brightness gain against the monochrome base; the brightest 0.1 % of texels may clip.

**Globe.** Oberon uses the shared raster lane with the shared 16 × 32 sphere mesh and Lambert lighting bank, and no atmosphere. Polar sprites are 1024 × 512 pixels and sample the original photographs directly ([shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)). The sphere does not encode measured relief. The world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts`. Named features are anchored with the map's left edge at 0° E; craters and faculae trace a rim circle, other types their published extent box. The navigation marker is a crop of observed terrain, not an observed full disc.

## Evidence

The map edge is measured against the georeferenced source at every preparation: the prepared normal map correlates 0.95 from 0° E and 0.16 from 180° E ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)). Geographic checks use [USGS Gazetteer](https://planetarynames.wr.usgs.gov/SearchResults?Target=97_Oberon) centers for Hamlet (44.4° E, 46.1° S), Macbeth (112.5° E, 58.4° S), Othello (42.9° E, 66° S) and Coriolanus (345.2° E, 11.4° S). These check numerical registration, not subpixel agreement with the Gazetteer's older feature outlines.

The colour oracle re-places every frame and correlates its high-passed detail against the mosaic ([report](source/reference/voyager-color-oracle.json)): 3 frames compared, mean correlation 0.40, mean residual 58.3 km. The mosaic is the same control the Monochrome dataset uses, so the colour lands on the ground the reader already sees.

## Known problems

- Source photometric correction does not remove local cast shadows or guarantee seamless exposures. The Monochrome view is a display of the published corrected observations, not a newly calibrated albedo measurement.
- The Voyager color dataset is false colour (green, violet, ultraviolet as red, green, blue) at the observations' own phase angles; no phase normalisation is applied, so a colour seam at a footprint edge is a real difference in viewing geometry. Its whole-disc band ratios are read from a figure at ±0.02, and the ultraviolet calibration carries a stated ±10 % uncertainty; the archive's own ratios are in the prepared report.
- Named feature outlines are not published nomenclature boundaries.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
