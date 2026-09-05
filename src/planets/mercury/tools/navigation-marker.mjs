export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "mercury",
  owner: "object",
  presentation: Object.freeze({"size":5}),
  source: Object.freeze({
    path: "navigation/mercury.jpg",
    expectedBytes: 876817,
    expectedSha256:
      "5ea3d3b713fce74f6b45faa182023210ada11ae62b8b51183a5fc134e7ce1304",
    origin:
      "https://science.nasa.gov/wp-content/uploads/2023/11/mercury-messenger-globe-pia15162.jpg",
    credit: "NASA/JHU APL/Carnegie Institution of Washington",
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
