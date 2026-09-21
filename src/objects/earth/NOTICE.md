# Earth source notices

## 2025 annual night lights

NASA's Black Marble nighttime lights product, VJ146A4 Collection 2,
`AllAngle_Composite_Snow_Free`, annual 2025.
[Product DOI](https://doi.org/10.5067/VIIRS/VJ146A4.002).
Public raw GeoTIFF mosaic: **Jurij Stare, www.lightpollutionmap.info**.
[Publisher source and reuse guidance](https://www.lightpollutionmap.info/help.html).
The publisher identifies the underlying NASA data as CC0 and requests these
credits when the data are used or displayed. cssEarth averages the radiance
offline and creates its own logarithmic false-color textures; it does not copy
the publisher's rendered map or sky-brightness model. No endorsement is implied.

## Blue Marble deep ocean

The deep ocean of the visible colour and cloud views is taken from NASA Earth
Observatory's Blue Marble Next Generation topography and bathymetry edition for
July 2004, `source/blue-marble-july-bathymetry.jpg`, on the same grid as the
plain July mosaic. Only its ocean is used, where the plain edition carries the
arbitrary deep-ocean reflectance described in Stöckli et al. (2005), section
2.4. Its relief-shaded land is not used. NASA image with credit and no
endorsement claim.

NASA and JPL material is credited to the named missions and institutions. NASA imagery is used under NASA's media usage guidelines; no NASA endorsement is implied. JPL data is factual United States government information, with Caltech/JPL attribution retained.

The atmosphere parameter values in `source/atmosphere/model.json` are adapted from the OpenSpace Team's RenderableAtmosphere tuning (MIT) and cited there; no OpenSpace file is read.

Inter is redistributed under the SIL Open Font License 1.1 in `source/presentation/LICENSE.INTER-OFL`.

The Earth adapter's prepared HTML, CSS, modules, charts, textures, and scientific presentation specifications are project-authored derivatives. Source credits remain embedded in this record and in the prepared chart metadata.

## GLAD-M35 mantle model

Congyue Cui et al. (2024), *GLAD-M35: a joint P and S global tomographic model
with uncertainty quantification*, Geophysical Journal International,
[doi:10.1093/gji/ggae270](https://doi.org/10.1093/gji/ggae270).
Data revision r0.1, provided by Congyue Cui through
[EarthScope EMC](https://ds.iris.edu/ds/products/emc-glad-m35/),
repository DOI 10.17611/dp/emc.2024.gladm35.1.

EMC publicly distributes this scientific model and requests citation of the
authors and repository. The downloaded model metadata and author repository do
not state a separate data license; we do not label the data as CC BY merely
because the paper is open access. cssEarth retains a numeric scientific-data
subset and creates its own false-color textures, with the coordinate,
interpolation, reference-mean and seam transformations described in [README](README.md).
No published illustration is copied and no author or EarthScope endorsement is
implied. EMC repository citation: IRIS DMC (2011),
[doi:10.17611/DP/EMC.1](https://doi.org/10.17611/DP/EMC.1).

Retired city-detail prototype (outside the globe MVP): ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. The 2021 v200 annual RGBNIR composites are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The retired city lens used the provider-rendered RGB PNGs directly through Terrascope WMTS and prepared their placement. Earlier COG experiments extracted RGB, applied a fixed display transfer, resampled geographic pages and encoded WebP. It does not use the categorical land-cover map. The publisher's metadata and attribution are recorded in `source/city/provenance.json`; no ESA or Copernicus endorsement is implied.

## GeoNames city catalogue

City names, aliases, administrative names and geographic points: GeoNames,
September 4, 2026 snapshot, licensed under CC BY 4.0.
Source: https://www.geonames.org/export/
License: https://creativecommons.org/licenses/by/4.0/
Modified into a search catalogue and prepared camera destinations. GeoNames
provides place locations; it does not provide or certify the imagery coverage.

## Buenos Aires noise estimates

Buenos Aires APrA, 2025 daytime noise map, licensed under [CC BY 2.5 Argentina](https://creativecommons.org/licenses/by/2.5/ar/). [Official dataset](https://data.buenosaires.gob.ar/dataset/mapa-ruido). The project rasterizes the published source geometry into transparent tiles and preserves the source color bins. These are estimates, not live readings. The pinned source, modifications and attribution are recorded in `source/noise/manifest.json`; no government endorsement is implied.

## GEBCO terrain model

GEBCO Bathymetric Compilation Group 2026 (2026). The GEBCO_2026 Grid — a continuous terrain model for oceans and land at 15 arc-second intervals. NERC EDS British Oceanographic Data Centre NOC. DOI: 10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa.

The GEBCO Grid is public domain, with source acknowledgement required by its published terms. cssEarth samples the numeric grid, applies its own height palette and cartographic relief, and prepares textures. No GEBCO, IHO or IOC endorsement is implied. The grid includes inferred depths and is not for navigation or safety at sea. [Terms and interpretation](https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid).

Place and region names: Natural Earth 1:10m populated places, geographic regions, marine areas and rivers (public domain; Tom Patterson, Nathaniel Vaughn Kelso and contributors); see `source/features/manifest.json`.
