export default Object.freeze({
  "schema": "cssearth-navigation-marker@1",
  "planetId": "pluto",
  "owner": "object",
  "presentation": {
    "size": 6
  },
  "source": {
    "path": "surface/pluto-color-mosaic.jpg",
    "expectedBytes": 952315,
    "expectedSha256": "1c13296bb0d2678224f3579033c4fe4cd302dc2a0afa02c94a0ff1baa56d53c9",
    "origin": "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/solar/2023/09/p/l/pluto_color_mapmosaic.jpg?crop=faces%2Cfocalpoint&fit=clip&h=2963&w=5926",
    "credit": "NASA/JHUAPL/SwRI",
    "license": "NASA/USGS public scientific data with attribution"
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
});
