# Antares

## Sources

Antares is the nearest red supergiant. Its package holds the placement, the published size and the record of what was tried for its surface, but no image of the photosphere could be cast from public data. A star with only its shape stays off the map until one can: `discoveryVisibility` hides it and its label, and its page still opens from search. The [investigation ledger](investigations.json) records the attempts.

**Placement.** The ICRS position, proper motion and parallax are SIMBAD's, from the Hipparcos re-reduction of van Leeuwen (2007, A&A 474, 653): parallax 5.89 ± 1.00 mas, 170 pc. The star is too bright for a Gaia parallax. The radial velocity, −3.5 ± 0.8 km/s, is Gontcharov (2006, Astronomy Letters 32, 759). The mass behind the display GM is the 15 ± 5 solar masses of Ohnaka et al. (2013).

**Radius.** Ohnaka et al. (2013, [A&A 555, A24](https://arxiv.org/abs/1304.4800)) measure a limb-darkened disc diameter of 37.38 ± 0.06 mas from VLTI/AMBER K-band continuum data of 2009. At the Hipparcos distance that is 474,700,204 km, 682 solar radii; the parallax uncertainty alone is 17 percent. Montargès et al. (2017, [A&A 605, A108](https://arxiv.org/abs/1705.07829)) find in the H band that the apparent diameter depends on position angle and channel, between 37.6 and 38.2 mas.

**Rotation: none measured.** No publication measures the rotation axis, period or prime meridian of Antares. The rotation record is the `cssearth-display-orientation@1` convention used for π¹ Gruis: the display axis is celestial north at the star, in the plane of the sky, and the display meridian faces the Sun and Earth at the scene epoch. The star record sets `presentationUp: display-axis`, so the camera orbit lies in that axis's equator and the default view is one degree from the sub-Earth point.

**Shape lens.** The surface is the `neutral-shape` science kind, the gray Eris and Makemake use: a display convention for an unresolved surface, not a colour or a brightness. The star is drawn by the emissive route like the other stars, with transparent off-limb and limb plates because there is no light to put on them. The navigation marker is a flat gray disc written by `tools/objects/source-authoring/antares/author.mts`.

**Catalogue colour.** #ffc595, the swatch that search, the catalogue and the minimap show. It is the shared star field's temperature-to-colour fit (`temperatureColor` in [color.ts](../../../src/preparation/stars/color.ts), the fit the HYG stars around it are drawn with) at the effective temperature recorded in [measurements.json](source/measurements.json). Effective temperature 3660 ± 120 K from Ohnaka et al. 2013 (A&A 555, A24; <https://arxiv.org/abs/1304.4800>), abstract: the bolometric flux with the VLTI/AMBER limb-darkened diameter 37.38 mas, the radius source. The fit is a display colour, not a spectrum, and the sphere itself stays neutral gray.

## Evidence

- [`investigations.json`](investigations.json) records the two image routes that were checked and excluded, with the measured numbers.
- `tests/objects/unit/antares/source.test.mts` verifies every pin, that the radius is the published diameter at the stated distance, that the lens is the neutral shape with no observation file, and that the marker is the authoring tool's output.
- `tests/objects/unit/antares/default-view.test.mts` derives the default camera from the runtime's camera math: the sub-camera point one degree from the sub-Earth point, the display axis and celestial north straight up.
- `site/test/object-discovery.test.mts` checks that Antares is hidden from the map under every discovery setting while the imaged stars stay visible.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/antares/` with the default camera.
- Run of 2026-09-21: [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #ffc595 is the star field's colour at the cited 3660 K.

## Known problems

**No image of the surface.** The public VLTI/PIONIER visibilities of April and May 2014, the data of Montargès et al. (2017), are the JMMC pipeline's automated product. The authors never imaged them, and their best models reach reduced chi-squared 25 to 44. The pinned SQUEEZE code does not converge on them: 15.5 at best on the merged set, 18.7 on the densest single night; only the sparsest night converges, to a featureless disc. The published VLTI/AMBER reconstructions of Ohnaka et al. are deposited as animated GIF movies, not data, and the AMBER files in the OiDB are raw.

**The axis is a convention.** Where the pole really points is unknown.

**The sky is the Sun's.** The star field behind Antares is the shared cube baked from the Sun's position.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
