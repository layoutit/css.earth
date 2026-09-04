export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "saturn",
  owner: "object",
  source: Object.freeze({
    path: "saturn-surface-original.jpg",
    expectedBytes: 1036492,
    expectedSha256: "5976d520c16f7c91a7415bdaeb1a050373a706c07adae29b38b8b5110d88acc0",
    origin: "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/saturn/textures/1/saturn.jpg",
    credit: "OpenSpace Team",
    license: "OpenSpace MIT license",
  }),
  operations: Object.freeze([
    Object.freeze({ type: "extract", left: 720, top: 0, width: 1440, height: 1440 }),
    Object.freeze({ type: "resize", width: "tile", height: "tile", kernel: "lanczos3" }),
    Object.freeze({ type: "ensure-alpha" }),
    Object.freeze({ type: "ellipse-mask", cx: 0.5, cy: 0.5, rx: 0.48, ry: 0.43 }),
    Object.freeze({ type: "png" }),
  ]),
});
