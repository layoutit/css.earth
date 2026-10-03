import { array, record, text, unique } from './world-guards.js';
import { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldSystem } from './world-context.js';
import type { PreparedWorldContext, PreparedWorldIndex } from './world-context.js';

/** The build's index of the world's bodies (`world-index.json`), checked. */
export function parsePreparedWorldIndex(value: unknown): PreparedWorldIndex {
  const input = record(value, 'world index', ['order', 'files', 'rows']);
  const order = array(input.order, 'world index order').map((id, index) => text(id, `world index order[${index}]`));
  unique(order, 'world index order');
  const files = array(input.files, 'world index files').map((id, index) => text(id, `world index files[${index}]`));
  unique(files, 'world index files');
  const places = new Set(order);
  const rows = record(input.rows, 'world index rows');
  for (const id of Object.keys(rows)) if (!places.has(id)) throw new TypeError(`The world index holds a row for ${id}, which has no place in its order.`);
  return Object.freeze({ order: Object.freeze(order), files: Object.freeze(files), rows: Object.freeze({ ...rows }) });
}
/** The whole world, every file read, in the full context's order: for build tools and tests. The index names every object
 * with a `members.json`, which `read` gives, from the root of the tree down, so an orbit's parent is placed before it; a
 * plain-dot star with nothing round it has its row in the index instead. */
export async function parseCompleteWorldContext(summary: unknown, read: (id: string) => Promise<unknown>, indexInput: unknown): Promise<PreparedWorldContext> {
  const index = parsePreparedWorldIndex(indexInput), files = index.files;
  let whole = parsePreparedWorldContextSummary(summary);
  const values = await Promise.all(files.map(read)), held = new Set<string>();
  const add = (id: string, value: unknown) => {
    const system = parsePreparedWorldSystem(value, whole, id);
    for (const body of system.bodies) {
      if (held.has(body.id)) throw new TypeError(`Prepared world file ${id} holds ${body.id}, which another file holds too.`);
      held.add(body.id);
    }
    whole = extendWorldContext(whole, [system], index.order);
  };
  files.forEach((id, at) => add(id, values[at]));
  for (const [id, row] of Object.entries(index.rows)) add(id, row);
  if (whole.bodies.length !== index.order.length) throw new TypeError(`The summary and its ${files.length} files hold ${whole.bodies.length} bodies, not the index's ${index.order.length}.`);
  return whole;
}
