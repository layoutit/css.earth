export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "mars",
  owner: "object",
  source: Object.freeze({
    path: "presentation/navigation-marker.jpg",
    expectedBytes: 139134,
    expectedSha256: "f55dad386a7d45e2758c0dc1d520c40dc6f2aaa517f08451facba738e121b8cb",
    origin: "https://science.nasa.gov/wp-content/uploads/2023/04/hs-2016-15-a-full_tif-jpg.webp",
    credit: "NASA, ESA, the Hubble Heritage Team (STScI/AURA), J. Bell (ASU), and M. Wolff (Space Science Institute)",
    license: "CC BY 4.0 under ESA/Hubble reuse terms",
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
