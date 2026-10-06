# TRAPPIST-1d

The page opens on a published climate model of the planet, labelled as a model. The [navigation marker](source/preparation/navigation.json) is drawn from that dataset with a prepared curvature cue; the shading is a display convention, not measured limb darkening.

## Sources

TRAPPIST-1d is the smallest of the inner four planets of [TRAPPIST-1](../trappist-1/README.md), an ultracool dwarf 12.47 parsecs away. Every number in this
package comes from Agol et al. (2021, PSJ 2, 1), who fitted the seven planets' transit times and the Spitzer and ground-based photometry together: the
planets perturb each other enough for their masses to be read from the timing of their transits.

**Size and mass.** 0.788 Earth radii and 0.388 Earth masses (Agol et al. (2021, PSJ 2, 1), Table 6), a density of 0.792 Earth's and a
surface gravity of 0.624 Earth's. The radius comes from the transit depth against the star's own radius; the mass from the
transit-timing variations, scaled by the stellar mass Mann et al. (2019) give.

**Orbit.** 4.0499 days at 0.02227 au, 1.115 times the starlight Earth receives (Agol et al. (2021, PSJ 2, 1), Tables 2, 5 and 6). The
scene draws a circle: the paper's eccentricity for this planet, 0.00563, moves it by up to 3.7 of its own radii, and is not drawn. The
period and transit time are the ones the Agol et al. (2024, arXiv:2409.11620) forecast gives around the scene epoch
(2026-09-03), which adds JWST timings to the Agol et al. (2021) model; their Table 2 period, 4.049219 d, is an osculating value at
the start of their simulation and drifts hours off by 2026. Transit-timing variations of -7.9 to +14.6 minutes about that
line are not modelled. The orbit's position
angle on the sky is not measured, so the ascending node is drawn at celestial north, a stated convention.

**Rotation.** Assumed synchronous: this close to its star the planet is expected to be tidally locked, and no rotation period of
TRAPPIST-1d is measured. Longitude 0 faces the star.

**What is not here.** No image, color or measured map of this planet exists. The neutral gray shape of an unresolved surface stays one dataset away, and the page says which view is a model.

**Climate model dataset.** The thermal radiation leaving the top of TRAPPIST-1d's atmosphere in the Generic PCM, from Turbet et al. (2023, A&A 679, A126, [arXiv:2308.15110](https://arxiv.org/abs/2308.15110)), released under CC BY 4.0 as [Zenodo record 5627945](https://zenodo.org/records/5627945). The file is `diagfi_T1d_1barN2_10barH2O.nc`: one bar of nitrogen with ten bars of water vapor, the steam atmosphere of a planet too hot for its water to condense, on a planet that keeps one face to its star. The variable is `OLR` in W m⁻² on the model's 64 × 49 grid, which stores its first meridian twice; that repeat is checked equal and read once. The star is overhead at the grid's longitude 0. The file holds 300 instants over 50 days and no time mean, so the map is one instant, the last output (`Time` index 299). It runs from 203.8 to 570.5 W m⁻², brightest under the star and along the equator and faintest toward the poles, where the run's water clouds are thickest, and is drawn in false color from 200 to 600. Nothing is averaged, smoothed or extrapolated in preparation.

Outgoing radiation is shown, not surface temperature, because under ten bars of steam the surface is nearly uniform: `tsurf` runs from 538.3 to 541.8 K in the same instant, which is no map. The first and last instants of `OLR` correlate at 0.99, so the instant stands for the run.

The 3.5 GB file is never fetched whole. [`new-object --simulation`](../../../packages/telescope-cli/src/new-object/simulation/simulation-dataset.mts) fetched two byte ranges of it, which the [manifest](source/manifest.json) declares and the source restore brings back: its first 6,024 bytes (the header and the coordinate variables) and the 25,480 bytes of `OLR` at that instant, where the header places them.

This is one scenario. Nobody has detected an atmosphere on TRAPPIST-1d. JWST's transmission spectrum of it is flat: it rules out thick clear atmospheres and leaves an extremely thin one, one with high-altitude clouds, or none (Piaulet-Ghorayeb et al. 2025, [arXiv:2508.08416](https://arxiv.org/abs/2508.08416)). The same release holds runs with 0.1, 1 and 10 bars of carbon dioxide; that spectrum rejects clear carbon-dioxide atmospheres like early Mars's and a cloud-free Venus's, so they are not shown. Another model, ROCKE-3D with an Earth-like atmosphere, finds a temperate surface possible within narrow limits (Way 2025, [arXiv:2502.00132](https://arxiv.org/abs/2502.00132)).

**Illustration dataset.** NASA's artist's concept of TRAPPIST-1d: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`TRAPPIST-1_d.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/TRAPPIST-1_d.jpg), 2,048 × 1,024, named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the color, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../packages/bake/src/objects/interpretation/interpret.ts)), so its longitudes are arbitrary. It is a second dataset: Shape stays the default. It is listed in the package's illustration datasets, so it never counts as imagery. An earlier TRAPPIST-1 set, NASA/JPL-Caltech maps made for NOAA's [Science On a Sphere](https://sos.noaa.gov/catalog/datasets/exoplanet-trappist-1d/) in March 2017, is different artwork and is not used; this package uses the map NASA's app shows today. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

- Run of 2026-10-04: all 3,185 stored cells of the kept range equal an independent range read of the release, and after deleting both kept parts [`restore-source-inputs.mts`](../../../packages/bake/cli/restore-source-inputs.mts) brought them back from Zenodo byte for byte. The page as it opens is shown with [TRAPPIST-1e](../trappist-1e/README.md#evidence). [`netcdf-lonlat-field.test.mts`](../../../packages/bake/src/objects/raster/netcdf/netcdf-lonlat-field.test.mts) checks the repeated meridian and the two-range form.
- Run of 2026-09-24: [`node packages/bake/src/prepare-object/index.ts`](../../../packages/bake/cli/prepare-object.mts) added the Illustration dataset; every image this package already delivered is byte-identical to main's. [`equirectangular-illustration.test.mts`](../../../packages/bake/src/objects/interpretation/equirectangular-illustration.test.mts) checks that the map keeps its left edge at 0° and that an emissive body gets transparent plates. In headless Chrome the dataset opens on the map with no console errors ([all ten planets](../../../docs/images/eyes-on-exoplanets-illustrations.webp)).

- `source.test.mts` checks the pins, and that the planet turns synchronously
  with longitude 0 on its star and orbits it;
  [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) checks that it transits at the published times.
- [`object-systems.test.mts`](../../../site/world/object-systems.test.mts) checks that the TRAPPIST-1 system holds all seven planets.
- Driven in a real browser: the seven orbits and labels draw around the star in the system view, and this planet's page opens on the
  climate model at the measured radius.

## Known problems

**No heat of this planet has been detected.** Cartigny et al. (2026, [arXiv:2608.18626](https://arxiv.org/abs/2608.18626)) searched the archival JWST MIRI data of TRAPPIST-1 for the outer planets' combined emission and could not reach the precision to detect it.

**The climate model is a scenario, not a finding.** It assumes a steam atmosphere nobody has detected, and it is one instant of one run. JWST leaves an atmosphere with high clouds possible but shows none; with a thin atmosphere or none the planet would look nothing like this map.

**No observation of the planet itself is shown.** Size, mass and orbit are measured; the surface is not. JWST has measured the
mid-infrared dayside brightness of TRAPPIST-1b and c (shown with those planets); this project has reduced no JWST observation of this planet.

**The orbit is circular here.** The measured eccentricity is small but not zero, and the transit-timing variations the masses come
from are not drawn.

**The Illustration dataset is art, not data.** Its colors, clouds and terrain are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no color corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
