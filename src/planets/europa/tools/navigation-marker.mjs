export default {
  "schema": "cssearth-navigation-marker@1",
  "planetId": "europa",
  "owner": "object",
  "presentation": {
    "size": 5
  },
  "source": {
    "id": "usgs-voyager-galileo-global-500m",
    "path": "europa-global-500m.tif",
    "expectedBytes": 192777263,
    "expectedSha256": "a323f0c9ccb47d5af9902ea8297fe81f9a9708795645b80801f103c3f7c9a624",
    "origin": "https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif",
    "credit": "NASA/JPL/USGS",
    "license": "Public USGS scientific imagery; see NOTICE.md",
    "licenseEvidence": [
      "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits"
    ],
    "acquisition": "Download the published GeoTIFF and verify its pinned bytes before preparation.",
    "redistribution": "Reacquirable source binary excluded from Git; prepared textures retain credits.",
    "consumers": [
      "surfaces",
      "navigation"
    ],
    "lensId": "normal",
    "label": "Monochrome",
    "falseColor": false,
    "width": 19631,
    "height": 9816,
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
      "referenceRadiusMeters": 1562089.9658
    },
    "coverage": "GeoTIFF GDAL_NODATA=0. Missing pixels receive the shared gray cartographic grid. Published observed shading and resolution differences are preserved."
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
