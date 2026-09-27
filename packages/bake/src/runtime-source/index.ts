// `@cssearth/bake/runtime-source` (Node only): the runtime-source reader preparation and the runtime ownership checks share.
// It parses a runtime module (TypeScript through the ESLint parser, JavaScript through Vite's) into ESTree with its original
// ranges, resolves workspace and relative imports to their source files through each package's exports and tsup entries, and
// reads names, keys and static object properties from the tree.
export * from './runtime-ast.ts';
export * from './runtime-source-graph.ts';
