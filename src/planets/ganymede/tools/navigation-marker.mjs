export default {
  "schema": "cssearth-navigation-marker@1",
  "planetId": "ganymede",
  "owner": "object",
  "presentation": {
    "size": 5
  },
  "source": {
    "id": "usgs-voyager-galileo-mono",
    "path": "ganymede-mono.tif",
    "expectedBytes": 136844537,
    "expectedSha256": "c2c8d9506b8cf8f7a0a90d823d9052e91c8d9885cf7267fdce8de8216f4df888",
    "origin": "https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif",
    "credit": "NASA/JPL/USGS",
    "license": "Public USGS scientific imagery; see NOTICE.md",
    "licenseEvidence": [
      "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits"
    ],
    "acquisition": "Download the published GeoTIFF and verify the pinned bytes before preparation.",
    "redistribution": "Reacquirable source TIFF excluded from Git; prepared textures retain credits.",
    "consumers": [
      "surfaces",
      "navigation"
    ],
    "lensId": "normal",
    "label": "Monochrome",
    "falseColor": false,
    "width": 16539,
    "height": 8270,
    "projection": {
      "type": "equirectangular",
      "longitudeDegrees": [
        0,
        360
      ],
      "latitudeDegrees": [
        90,
        -90
      ],
      "longitudeDirection": "east-positive",
      "referenceRadiusMeters": 2632344.9707
    },
    "coverage": "GDAL_NODATA=0. Explicit gaps retain the shared gray grid. Missing color and the documented synthesized-red sector retain observed monochrome."
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
