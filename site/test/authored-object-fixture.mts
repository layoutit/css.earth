export interface AuthoredObjectFixtureOptions {
  readonly path?: string;
}

export function authoredObjectFixture(id: string, { path = "source/surface.json" }: AuthoredObjectFixtureOptions = {}) {
  return {
    schema: "cssearth-object@1", id, type: "layered-body",
    prepared: { format: "fixture@1", url: `/scenes/${id}/object.json` },
    properties: { recipe: {
      schema: "cssearth-authored-object@1",
      sources: [{ id: "surface", path }],
      shape: { kind: "sphere", radiusKm: 2 },
      surfaces: [{ id: "body", source: "surface", projection: "equirectangular",
        lenses: [{ id: "normal", source: "surface" }] }],
    } },
  };
}
