export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "moon",
  owner: "object",
  presentation: Object.freeze({"size":6}),
  source: Object.freeze({
    path: "surface/lroc-color-2k.jpg",
    expectedBytes: 457942,
    expectedSha256: "f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170",
    origin: "https://svs.gsfc.nasa.gov/4720/",
    credit: "NASA SVS, LRO, LROC and LOLA",
    license: "NASA media usage guidelines",
  }),
  operations: Object.freeze([
    Object.freeze({ type: "resize", width: "tile", height: "tile", fit: "cover", position: "centre", kernel: "lanczos3" }),
    Object.freeze({ type: "png" }),
  ]),
});
