export default {
  "schema": "cssearth-navigation-marker@1",
  "planetId": "io",
  "owner": "object",
  "presentation": {
    "size": 5
  },
  "source": {
    "id": "usgs-normal-global-1km",
    "path": "io-global-1km.tif",
    "expectedBytes": 65546342,
    "expectedSha256": "cf65a0323aac9c4c9eb582aa7b7ce0d36be8e445316fa6dba49ab5647b63584c",
    "origin": "https://planetarymaps.usgs.gov/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_1km.tif",
    "credit": "NASA/JPL/USGS",
    "license": "Public domain USGS imagery",
    "licenseEvidence": [
      "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits"
    ],
    "acquisition": "Download the published GeoTIFF and verify pinned bytes before preparation.",
    "redistribution": "Reacquirable source binary excluded from Git; prepared textures retain credits.",
    "consumers": [
      "surfaces",
      "navigation"
    ],
    "lensId": "normal",
    "label": "Monochrome",
    "falseColor": false,
    "width": 11445,
    "height": 5723,
    "projection": {
      "type": "equirectangular",
      "longitudeDegrees": [
        -180,
        180
      ],
      "latitudeDegrees": [
        90,
        -90
      ],
      "longitudeDirection": "east-positive",
      "referenceRadiusMeters": 1821460,
      "centerLongitudeDegrees": 0
    },
    "coverage": "GeoTIFF GDAL_NODATA=0. Preserve valid dark pixels; withhold resampled no-data boundaries."
  },
  "operations": [
    {
      "type": "resize",
      "width": "tile",
      "height": "tile",
      "fit": "cover",
      "position": "centre",
      "kernel": "lanczos3"
    },
    {
      "type": "png"
    }
  ]
};
