// `@cssearth/bake/preparation` (Node only): the preparation cache and the record format of the preparation trace, which
// `packages/bake/cli/preparation-trace.mts` writes for each process of a body's preparation and the cache keys a body's
// outputs on. It imports no topic, and no project module but `@cssearth/core`: the trace loads this entry before it
// starts recording. `stale-builds.ts` says which build a run would read stale; its command loads it from source.
export * from './preparation-cache.ts';
export * from './preparation-trace-format.ts';
export * from './stale-builds.ts';
