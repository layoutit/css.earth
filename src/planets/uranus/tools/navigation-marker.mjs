export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "uranus",
  owner: "object",
  presentation: Object.freeze({"size":10,"ringAngle":78,"ringExtra":11,"ringHeight":4,"ringOpacity":0.55}),
  source: Object.freeze({
    path: "navigation/uranus.jpg",
    expectedBytes: 83489,
    expectedSha256:
      "3dcc83114f1a25caa1ae1a1436830fffaa15a3e429666dbf4c68bcf035e8932b",
    origin:
      "https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg",
    credit: "NASA/JPL-Caltech",
    license: "NASA media usage guidelines",
  }),
  operations: Object.freeze([
    Object.freeze({ type: "rotate" }),
    Object.freeze({ type: "trim", threshold: 10 }),
    Object.freeze({
      type: "resize",
      width: "tile",
      height: "tile",
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    }),
    Object.freeze({ type: "png" }),
  ]),
});
