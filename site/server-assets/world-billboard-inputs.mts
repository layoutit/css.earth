const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export interface WorldBillboardInput {
  readonly index: number;
  readonly billboard: Readonly<Record<string, unknown>>;
  readonly address: string;
  readonly owner?: string;
}

/** The exact addresses the build resolves, including a body's implicit photograph. Shared by resolution and caching. */
export function worldBillboardInputs(document: unknown): { billboards: unknown[]; inputs: WorldBillboardInput[] } | null {
  const bodies = record(document) && record(document.bodies) ? document.bodies : undefined;
  const ids = bodies?.id, billboards = bodies?.billboard;
  if (billboards === undefined) return null;
  if (!Array.isArray(ids) || !Array.isArray(billboards) || ids.length !== billboards.length) {
    throw new TypeError('A world file names its bodies and their billboards column by column, of equal length.');
  }
  const plain = Array.isArray(bodies?.plainDot) ? bodies.plainDot : [];
  const inputs: WorldBillboardInput[] = [];
  for (const [index, billboard] of billboards.entries()) {
    if (billboard === null || plain[index] === true) continue;
    if (!record(billboard)) throw new TypeError('A world billboard must be an object or null.');
    const id = String(ids[index]);
    const address = typeof billboard.url === 'string' ? billboard.url : `/scenes/${id}/${id}-billboard.webp`;
    const owner = /^\/scenes\/([a-z][a-z0-9-]*)\/.+$/u.exec(address)?.[1];
    inputs.push({ index, billboard, address, ...(owner === undefined ? {} : { owner }) });
  }
  return { billboards, inputs };
}
