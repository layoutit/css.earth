export default Object.freeze({
  schema: "cssearth-navigation-marker@1",
  planetId: "neptune",
  owner: "object",
  presentation: Object.freeze({"size":10,"ringAngle":-28,"ringExtra":11,"ringHeight":4,"ringOpacity":0.56}),
  source: Object.freeze({
    path: "opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f467m-f547m-f657n_v1_globalmap.tif",
    expectedBytes: 789926,
    expectedSha256: "8c17a2872b5d55577c63abe7ba1369997ff32bb83e0f9b9c350a46db96713cb8",
    origin: "Hubble OPAL Cycle 32 Neptune colour global map",
    credit: "NASA, ESA, OPAL team, and STScI",
    license: "MAST public science data terms",
  }),
  operations: Object.freeze([
    Object.freeze({ type: "resize", width: "tile", height: "tile", fit: "cover", position: "centre", kernel: "lanczos3" }),
    Object.freeze({ type: "ensure-alpha" }),
    Object.freeze({ type: "ellipse-mask", cx: 0.5, cy: 0.5, rx: 0.48, ry: 0.47 }),
    Object.freeze({ type: "png" }),
  ]),
});
