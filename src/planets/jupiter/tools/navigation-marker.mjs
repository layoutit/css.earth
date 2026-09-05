export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "jupiter",
  owner: "object",
  presentation: Object.freeze({"size":16,"ringAngle":-2,"ringExtra":6,"ringHeight":3,"ringOpacity":0.25}),
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
    // The source has stray pixels along row 0. Crop the observed disk directly
    // so automatic trimming cannot retain a black cap above the north limb.
    Object.freeze({ type: "extract", left: 122, top: 150, width: 1079, height: 1019 }),
    Object.freeze({
      type: "resize",
      width: "tile",
      height: "tile",
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    }),
    Object.freeze({ type: "ensure-alpha" }),
    Object.freeze({ type: "ellipse-mask", cx: 0.5, cy: 0.5, rx: 0.5, ry: 0.5 }),
    Object.freeze({ type: "png" }),
  ]),
});
