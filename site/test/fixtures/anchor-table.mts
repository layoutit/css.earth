// CSSEARTH_TEST_OBJECTS=<id>[,<id>] limits a run over every body to those bodies, which is how the per-object runner
// exercises a single body.
export function selectedObjectIds(ids: readonly string[], selection = process.env.CSSEARTH_TEST_OBJECTS): string[] {
  const requested = (selection ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (requested.length === 0 || requested.includes('all')) return [...ids];
  return ids.filter(id => requested.includes(id));
}
