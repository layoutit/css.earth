export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "jupiter",
  owner: "object",
  source: Object.freeze({
    path: "presentation/navigation-marker.png",
    expectedBytes: 1166501,
    expectedSha256: "50d1a1cb022550f18e835d9f8cb56e44c9b8196dfd19954ae6413c6e92fc3ebe",
    origin: "https://science.nasa.gov/wp-content/uploads/2024/03/hubble-jupiter-5jan2024-stsci-01hpmmsxbevgs2hk67vyvnveg5.png",
    credit: "NASA, ESA, STScI, and Amy Simon",
    license: "NASA media usage guidelines and credited partner rights",
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
