export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "sun",
  owner: "object",
  presentation: Object.freeze({ size: 16 }),
  source: Object.freeze({
    path: "sdo/continuum/CR2311/20260513_000000_1024_HMIIC.jpg",
    expectedBytes: 201610,
    expectedSha256: "3f892eddb79a3e0918968f789ffde00296fd1dab3db70deb4a3a0e84e2987fd8",
    origin: "https://sdo.gsfc.nasa.gov/assets/img/browse/2026/05/13/20260513_000000_1024_HMIIC.jpg",
    credit: "NASA/SDO and the HMI science team",
    license: "NASA media usage guidelines and SDO data use policy",
  }),
  operations: Object.freeze([
    { type: "trim", threshold: 10 },
    { type: "resize", width: "tile", height: "tile", fit: "cover", position: "centre", kernel: "lanczos3" },
    { type: "png" },
  ]),
});
