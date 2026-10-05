# Iapetus

Iapetus shows a Cassini/Voyager monochrome mosaic, an enhanced-color map, two Cassini VIMS infrared views and a Cassini CIRS temperature map of part of the dark leading side.

## Sources

| View | Source and quantity |
| --- | --- |
| Monochrome | [USGS Cassini/Voyager mosaic](https://astrogeology.usgs.gov/search/map/iapetus_cassini_voyager_global_mosaic_803m), May 2008; about 803 m per source pixel. |
| Enhanced color | [JPL PIA18436](https://www.jpl.nasa.gov/images/pia18436-color-maps-of-iapetus-2014/), 2014; calibrated and photometrically corrected Cassini ultraviolet/infrared imagery. |
| Infrared and Ice absorption | [Nantes Cassini VIMS archive](https://vims.univ-nantes.fr/), three observations from 10 September 2007. Infrared maps near-2.02/1.59/1.28 µm channels to false color; Ice absorption measures the near-2.02 µm feature relative to its continuum. |
| Temperature | [NASA PIA07005](https://science.nasa.gov/photojournal/iapetus-temperature-map/), January 2005: Cassini CIRS surface temperatures from the 31 December 2004 flyby, as NASA published them in a map figure. Covers part of the dark leading side (18% of the globe). The legend repeats the figure's 70-130 K color bar. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/IAPETUS/target) Iapetus centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin. |

Physical facts are from [NASA](https://science.nasa.gov/saturn/moons/iapetus/). The sphere uses the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 734.30 km. Feature notes for 11 names are the lead summary of their English Wikipedia article (CC BY-SA 4.0), recorded in `source/features/notes.json` and credited in the caption.

Lighting uses the lunar-like (Lommel–Seeliger) law and phase function [Buratti and Mosher (1995)](https://doi.org/10.1006/icar.1995.1093) fitted to Voyager images. See [Lighting law](#lighting-law).

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

**Monochrome.** The USGS mosaic is 5760 × 2880 and contains Cassini images, Voyager polar images and some Saturnshine observations. Exactly zero is no-data; nonzero dark terrain is preserved. The source already includes the documented 4.5-degree westward IAU longitude correction.

**Enhanced color.** PIA18436 is 11741 × 5871, nominal 400 m per source pixel. Paul Schenk selected, calibrated, registered and photometrically corrected the Cassini imagery. Its colors extend beyond human vision into ultraviolet and infrared. The dark leading hemisphere is actual surface albedo and is not normalized away.

**Infrared and ice absorption.** The calibrated VIMS cubes and navigation are retained beside the body, pinned by the [recipe](source/cassini-ice/prepare.json). Infrared assigns channels near 2.02, 1.59 and 1.28 µm to red, green and blue. Ice absorption is `1 - R(near 2.02 µm) / continuum(near 1.82 µm, near 2.20 µm)`. Saturated and special values are excluded, and gaps are not interpolated. See the [registration record](source/cassini-ice/evidence/registration.md).

**Temperature.** The map is cleaned from NASA's published figure. Its frame and ticks give 2.000 figure pixels per degree, and the fit is good to about 0.25°. West longitude becomes east longitude, so the figure covers 180–360° E. The bar's 12 steps span 70 to 130 K, and the legend shows the same 12 colors. [`figures/pia07005-map.json`](source/figures/pia07005-map.json) withholds grid lines, ticks, the subsolar asterisk and the black background. `node packages/bake/authoring/figure-map/clean-figure-map.mts src/objects/iapetus/source/figures/pia07005-map.json` writes the cleaned crop.

The globe uses the shared raster lane, lit by its published law (see [Lighting law](#lighting-law)), with no atmosphere, fake elevation or gap filling. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes how polar sprites sample the original photographs directly.

## Lighting law

The globe is lit with the law [Buratti and Mosher (1995)](https://doi.org/10.1006/icar.1995.1093) fitted to each Voyager image of Iapetus: I/F = f(α) A μ0/(μ0 + μ) + (1 − A) μ0, with A = 1 for all of them. That leaves the Lommel–Seeliger law, which has no parameter. It was read in the paper's [JPL Open Repository preprint](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/29299), page 6. The phase function f is the paper's Table 1, clear-filter rows: 0.937 at 14° falling to 0.532 at 90°, joined by straight lines, with f = 1 at 0° and held beyond 90°. The law is recorded in [`source/photometry/buratti-mosher-1995-lommel-seeliger-clear.json`](source/photometry/buratti-mosher-1995-lommel-seeliger-clear.json).

Each lighting frame is the law relative to the flood-lit disc centre. With the Sun behind the viewer this law is flat: the limb is as bright as the centre. At 0.98 of the radius the overlay alpha is 0, where the authored bank this replaces reached 0.49. With Shadows on, the lit side dims with phase as f does. See [planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws).

## Evidence

The prepared map starts at 0° E, set in `source/presentation/surface-map.json` ([where the prepared map starts](../../../docs/surface-preparation.md#where-the-prepared-map-starts)). Three measurements on the prepared files agree:

- On the Enhanced color atlas, Cassini Regio falls at 150–360° E, centred near 255° E.
- The largest Gazetteer craters land on their basins: Engelier (95.3° E, 40.5° S), Gerin (127° E, 45.6° S), Turgis (331.6° E, 16.9° N) and Malprimis (241.8° E, 15.2° S).
- The prepared Monochrome map correlates 0.82 with its georeferenced source from 0° E and 0.21 from 180° E; Enhanced color 0.96 and −0.58.

The temperature crop keeps 18.0% of the sphere by area. Against the base mosaic, its change from red to magenta falls on the edge of the dark Cassini Regio to within 5°. The Temperature dataset has not been baked or looked at in the app yet.

## Known problems

- **Lighting law:** The paper uses one phase value per image for bright and dark terrain alike. Its values are joined by straight lines here, and held beyond 90° phase. Its emission limit, 83.6°, is derived here. The Icarus version of the paper was not read, only its preprint.
- Feature outlines are not published nomenclature boundaries. Craters and faculae trace a rim circle, other types their published extent box.
- Both VIMS maps cover about 23.4% of reference-sphere solid angle, not measured physical surface area. Native scan gaps stay missing. Infrared bilinear/WebP sampling can soften mask edges.
- The independent USGS comparison supports gross VIMS framing; precise local absolute registration remains unqualified.
- VIMS has no photometric correction or cross-observation level matching. Illumination, viewing angle, grain size, noise and archive filtering remain in the signal; neither view measures ice abundance.
- The enhanced-color mosaic has no independent validity mask. Real dark terrain is retained, along with coarse polar imagery, seams and residual photographed shading.
- Temperature is one moment of one flyby. Local time matters as much as the surface: the Sun was overhead near 106° W, 9° S (the figure's asterisk). Places away from that point were in morning, evening or night.
- Temperature shows NASA's published colors, not numbers. The map's colors change smoothly, but the bar has 12 steps, so a color can be read only to the nearest bar step. About 3% of the kept pixels, near noon, are paler than the bar's top step, and the figure gives no value for them.
- Temperature's grid lines, axis ticks and asterisk are shown as missing (no data) strips and a small square, not filled in. The figure's black and its compression halo are also missing, so the dataset cannot show whether a black area was unobserved or colder than 70 K.
- Geometry is a 734.3 km mean-radius sphere, without the oblate figure or equatorial ridge. The IAU figure is 745.7 km at the equator and 712.1 km at the poles ([pck00010.tpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc)), 4.5% flattened; the [ledger](investigations.json) says what in the shared geometry must change before it can be drawn. No qualified downloadable height raster was found in the 2026-09-06 source search: the [current PDS SPC archive](https://sbnarchive.psi.edu/pds4/cassini/) has no Iapetus bundle, the [2025 author abstract](https://meetingorganizer.copernicus.org/EPSC-DPS2025/EPSC-DPS2025-115.html) says Iapetus is forthcoming, and the [USGS inventory](https://fdp.astrogeology.usgs.gov/fdp/saturn/) lists older stereo topography as unreleased. This does not establish that terrain models do not exist.
- The default photographic surface uses quarter dimensions on iPad. This reduces display detail, not the resolution of the preserved source observations.
