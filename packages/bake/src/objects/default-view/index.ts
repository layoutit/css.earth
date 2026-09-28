// `@cssearth/bake/objects/default-view` (Node only): what a prepared object's default camera looks at, from the runtime's own
// camera math and the solar geometry the host passes in, with the check that a photograph lens's default camera faces the
// lens; and the default lens's data coverage, read from its prepared minimap, that the default camera turns toward. A topic
// of its own, outside `objects/scene`, whose code the nebula lab's compiler identity reaches.
export * from './default-view.ts';
export * from './lens-coverage.ts';
export * from './lens-facing.ts';
