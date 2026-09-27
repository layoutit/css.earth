// `@cssearth/bake/preparation` (Node only): the record format of the preparation trace, which
// `packages/bake/cli/preparation-trace.mts` writes for each process of a body's preparation. It imports no topic, and no
// project module but `@cssearth/core`: the trace loads this entry before it starts recording.
export * from './preparation-trace-format.ts';
