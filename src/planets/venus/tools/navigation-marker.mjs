export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "venus",
  owner: "object",
  source: Object.freeze({
    path: "navigation/venus.webp",
    expectedBytes: 210095,
    expectedSha256: "59ff56b81de18402302f1e397384bd1d7fecff906d04ef229a64462fe516f42a",
    origin: "https://science.nasa.gov/wp-content/uploads/2023/05/688-venus-1200-jpg.webp",
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
