export default Object.freeze({
  "schema": "cssearth-navigation-marker@1",
  "planetId": "ceres",
  "owner": "object",
  "presentation": {
    "size": 5
  },
  "source": {
    "path": "ceres-fc-global.png",
    "expectedBytes": 9750062,
    "expectedSha256": "44de5317d0989d3e1b05feaf970c21c36f51b193c0972dc19bb678ecd8e89c7c",
    "origin": "https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/asteroid_belt/ceres_simp_cyl.map&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Ceres_FC_global&STYLES=&SRS=EPSG:4326&BBOX=0,-90,360,90&WIDTH=4096&HEIGHT=2048&FORMAT=image/png",
    "credit": "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA",
    "license": "Public scientific imagery with attribution; see NOTICE.md"
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
