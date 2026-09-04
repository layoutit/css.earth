export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "earth",
  owner: "object",
  source: Object.freeze({
    path: "earth-navigation.jpg",
    expectedBytes: 183367,
    expectedSha256: "48ccd32ef57d182662999905841109095d66d68d69e27dba7decc6e134a811a0",
    origin: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001016/GSFC_20171208_Archive_e001016~large.jpg",
    credit: "NASA",
    license: "NASA media usage guidelines",
  }),
  operations: Object.freeze([
    Object.freeze({ type: "rotate" }),
    Object.freeze({ type: "trim", threshold: 10 }),
    Object.freeze({ type: "resize", width: "tile", height: "tile", fit: "cover", position: "centre", kernel: "lanczos3" }),
    Object.freeze({ type: "png" }),
  ]),
});
