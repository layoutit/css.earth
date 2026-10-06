import { scanCssDeclarations } from '../css/css-declaration-scanner.ts';

// Alternative meshes as prepared records (the last steps of the presentation bindings, prepared-presentation-bindings.ts).
//
// A body with several shape models carries one mesh per model under one parent. The node builder names each mesh as a
// custom property: a mesh leaf's style ends `display:var(--<id>-<model>-display,<fallback>)`, the fallback `block` on the
// first model and `none` on the rest, and each selection writes `block` on the mesh its dataset draws on and `none` on
// the others (radial-models.ts, solid-scene.ts). The bindings measure that form in a browser. What ships names no custom
// property:
// - the tree lists each mesh's leaves as runs of node indices (`tree.meshes`), and a leaf carries no display of its own;
// - a selection names the mesh it mounts (`variant.mesh`) and writes no display.
// The page mounts the named mesh's leaves and no other (packages/renderer/src/rendering/dom/prepared-omitted-nodes.ts). A
// later bindings run expands the records back to the variable form first.

interface TreeNode { parent: number; style: string }
interface Mesh { name: string; leaves: readonly (readonly [number, number])[] }
interface Tree { nodes: readonly TreeNode[]; meshes?: readonly Mesh[] }
interface Write { kind: string; target: number; name: string; value?: unknown }
interface Variant { when?: unknown; writes: readonly Write[]; mesh?: string }
interface Definition { id: string; tree: Tree; variants: readonly Variant[] }

const READ = /^display\s*:\s*var\(\s*(--[\w-]+-display)\s*(?:,\s*(?:block|none)\s*)?\)$/u;
/** A mesh's name is its variable without the dashes and the `-display` it ends with. */
const meshName = (variable: string) => variable.slice(2, -'-display'.length);
const variableOf = (name: string) => `--${name}-display`;
const read = (variable: string, fallback: string) => `display:var(${variable},${fallback})`;

/** The variable form's alternative meshes as records; no leaf reads a display variable and no selection writes one. */
export function withMeshRecords<D extends Definition>(definition: D): D {
  const { tree } = definition, leaves = new Map<string, number[]>();
  const nodes = tree.nodes.map((node, index) => {
    if (!node.style.includes('-display')) return node;
    const parts = [...scanCssDeclarations(node.style)], at = parts.findIndex(part => READ.test(part));
    if (at < 0) return node;
    const variable = READ.exec(parts[at]!)![1]!;
    leaves.set(variable, [...leaves.get(variable) ?? [], index]);
    // The builder writes the read last, so the rest of the style returns byte for byte; elsewhere the others are rejoined.
    const tail = `;${parts[at]!}`;
    return { ...node, style: node.style.endsWith(tail) ? node.style.slice(0, -tail.length) : parts.filter((_, part) => part !== at).map(part => `${part};`).join('') };
  });
  if (!leaves.size) return definition;
  if (tree.meshes?.length) throw new TypeError(`${definition.id}: the tree lists meshes and its leaves still read a display variable.`);
  const parents = new Set([...leaves.values()].flat().map(leaf => tree.nodes[leaf]!.parent));
  if (parents.size !== 1) throw new TypeError(`${definition.id}: the alternative meshes ${[...leaves.keys()].join(', ')} sit under ${parents.size} parents (nodes ${[...parents].join(', ')}); they must share one.`);
  const meshes = [...leaves].map(([variable, indices]) => {
    const runs: [number, number][] = [];
    for (const index of indices) { const last = runs.at(-1); if (last && last[0] + last[1] === index) last[1]++; else runs.push([index, 1]); }
    return { name: meshName(variable), leaves: runs };
  });
  const variants = definition.variants.map(variant => {
    const shown = variant.writes.filter(write => write.kind === 'style' && leaves.has(write.name) && write.value === 'block');
    const others = variant.writes.filter(write => leaves.has(write.name) && !shown.includes(write));
    const stray = others.find(write => write.kind !== 'style' || write.value !== 'none');
    if (shown.length !== 1 || stray || shown.length + others.length !== leaves.size) {
      throw new TypeError(`${definition.id}: selection ${JSON.stringify(variant.when)} must show one mesh and hide the others; it writes ` +
        `${variant.writes.filter(write => leaves.has(write.name)).map(write => `${write.name}=${String(write.value)}`).join(', ') || 'no mesh display'}.`);
    }
    return { ...variant, writes: variant.writes.filter(write => !leaves.has(write.name)), mesh: meshName(shown[0]!.name) };
  });
  return { ...definition, tree: { ...tree, nodes, meshes }, variants };
}

/** The records expanded back to the variable form the bindings measure (the inverse of withMeshRecords): each mesh leaf
 * reads its display variable at the end of its style, and each selection writes every mesh's display on the meshes'
 * parent, after its leading texture writes, as the builder orders them. */
export function withoutMeshRecords<D extends Definition>(definition: D): D {
  const { tree } = definition, meshes = tree.meshes ?? [];
  if (!meshes.length) return definition;
  const reads = new Map<number, string>();
  for (const [order, mesh] of meshes.entries()) for (const [first, count] of mesh.leaves) for (let leaf = first; leaf < first + count; leaf++) {
    if (reads.has(leaf) || !tree.nodes[leaf]) throw new TypeError(`${definition.id}: mesh ${mesh.name} lists node ${leaf}, which is outside the tree or in another mesh.`);
    reads.set(leaf, read(variableOf(mesh.name), order === 0 ? 'block' : 'none'));
  }
  const parent = tree.nodes[meshes[0]!.leaves[0]![0]]!.parent;
  const nodes = tree.nodes.map((node, index) => {
    const declaration = reads.get(index);
    return declaration === undefined ? node : { ...node, style: node.style ? `${node.style}${node.style.endsWith(';') ? '' : ';'}${declaration}` : declaration };
  });
  const { meshes: _meshes, ...rest } = tree;
  const variants = definition.variants.map(variant => {
    if (variant.mesh === undefined || !meshes.some(mesh => mesh.name === variant.mesh)) throw new TypeError(`${definition.id}: selection ${JSON.stringify(variant.when)} names the mesh ${String(variant.mesh)}; the tree lists ${meshes.map(mesh => mesh.name).join(', ')}.`);
    const lead = variant.writes.findIndex(write => write.kind !== 'texture'), at = lead < 0 ? variant.writes.length : lead;
    const display = meshes.map(mesh => ({ kind: 'style', target: parent, name: variableOf(mesh.name), value: mesh.name === variant.mesh ? 'block' : 'none' }));
    const { mesh: _mesh, ...kept } = variant;
    return { ...kept, writes: [...variant.writes.slice(0, at), ...display, ...variant.writes.slice(at)] };
  });
  return { ...definition, tree: { ...rest, nodes }, variants } as D;
}
