import { scanCssDeclarations } from './css-declaration-scanner.ts';

// Clean prepared nodes (the last step of the presentation bindings, prepared-presentation-bindings.ts, and of the node
// builder's finish, prepared-node-tree.ts).
//
// The builder works in a full inline form: every projective leaf carries `data-prepared-projection="single-leaf"` and the
// same five declarations, every raster triangle three constant `data-polycss-texture-*` attributes, and each node's
// static style keeps the declarations its later properties replace. What ships is this clean form instead:
// - every declaration once, in its final value: a static declaration, or an earlier property, that a later property of
//   the same name replaces is dropped (a later declaration of one name sets every longhand the earlier one set);
// - a projective leaf carries the class PREPARED_LEAF_CLASS; the shell stylesheet (site/object-shell.css) gives that class
//   PREPARED_LEAF_RULE, and background-origin and -clip go, since a leaf has no border or padding for them to change;
// - the constant raster triangle attributes go: nothing at runtime reads them.
// A declaration stays inline wherever another inline declaration also sets its longhand (a `background` shorthand), since
// dropping it would expose that one instead of the rule. withoutCleanLeaves restores the markers and declarations (not the
// dropped duplicates, which never took effect) for the bindings' browser measurement and the leaf layout check.

export const PREPARED_LEAF_CLASS = 'prepared-leaf';
const PROJECTION = ['data-prepared-projection', 'single-leaf'] as const;
/** The shell stylesheet's rule for PREPARED_LEAF_CLASS (site/object-shell.css), as the builder wrote it on each leaf. */
export const PREPARED_LEAF_RULE: Readonly<Record<string, string>> = { transformStyle: 'preserve-3d', backgroundRepeat: 'no-repeat', pointerEvents: 'none' };
/** Initial or no-op on a leaf without border or padding: the builder wrote them; nothing replaces them. */
const LEAF_NO_OPS: Readonly<Record<string, string>> = { backgroundOrigin: 'border-box', backgroundClip: 'border-box' };
/** Every `u` raster triangle carries these (radial-terrain.ts); the prepared scene keeps them, the runtime tree does not. */
export const RASTER_TRIANGLE_ATTRIBUTES: Readonly<Record<string, string>> = {
  'data-polycss-texture-leaf-sizing': 'raster', 'data-polycss-texture-backend': 'atlas', 'data-polycss-texture-lighting': 'baked' };
const SHORTHANDS: Readonly<Record<string, readonly string[]>> = {
  'transform-style': ['all'], 'pointer-events': ['all'],
  'background-repeat': ['background', 'all'], 'background-origin': ['background', 'all'], 'background-clip': ['background', 'all'],
};

interface Property { name: string; value: string; custom: boolean }
interface TreeNode { tag: string; className: string | null; style: string; properties: readonly number[]; attributes: Readonly<Record<string, string>> }
interface Tree { nodes: readonly TreeNode[]; properties: readonly Property[] }

/** A property's CSS name: custom names as written, native IDL names in dashes (webkitX is -webkit-x). */
export function preparedPropertyName({ name, custom }: Pick<Property, 'name' | 'custom'>) {
  if (custom || name.startsWith('--')) return name.startsWith('--') ? name : name.toLowerCase();
  return name.replace(/^(webkit|moz|ms)(?=[A-Z])/, '-$1').replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}
/** A static style's declarations, split where CSS splits them: not inside quotes or parentheses (URLs). */
function declarations(style: string) {
  const parts: { name: string; text: string }[] = [];
  for (const text of scanCssDeclarations(style)) {
    const colon = text.indexOf(':');
    if (colon < 1) throw new TypeError(`Prepared CSS declaration is invalid: ${text}`);
    const name = text.slice(0, colon).trim();
    parts.push({ name: name.startsWith('--') ? name : name.toLowerCase(), text });
  }
  return parts;
}
const classes = (className: string | null) => className?.split(/\s+/u).filter(Boolean) ?? [];
const sides = (name: string) => /^padding(?:-|$)/u.test(name) || /^border(?:-|$)/u.test(name) && !/radius/u.test(name);

function interned<T extends Tree>(tree: T, nodes: readonly T['nodes'][number][], table: readonly Property[]): T {
  const properties: Property[] = [], ids = new Map<string, number>();
  const intern = (property: Property) => {
    const key = JSON.stringify(property);
    if (!ids.has(key)) { ids.set(key, properties.length); properties.push(property); }
    return ids.get(key)!;
  };
  return { ...tree, nodes: nodes.map(node => ({ ...node, properties: node.properties.map(id => intern(table[id]!)) })), properties };
}

/** One node's clean record: declarations once, and the shared leaf markers as a class. */
function cleanNode<N extends TreeNode>(node: N, table: readonly Property[]): N {
  const properties = node.properties.map(id => ({ id, property: table[id]!, name: preparedPropertyName(table[id]!) }));
  const statics = declarations(node.style);
  const later = (name: string, from: number) => properties.slice(from).some(entry => entry.name === name);
  // Each declaration once: a static one no later static one or property replaces, a property no later property replaces.
  let keptStatics = statics.filter((entry, at) => !later(entry.name, 0) && !statics.slice(at + 1).some(next => next.name === entry.name));
  let keptProperties = properties.filter((entry, at) => !later(entry.name, at + 1));
  const attributes = { ...node.attributes };
  let names = classes(node.className);
  const projective = attributes[PROJECTION[0]] === PROJECTION[1] || names.includes(PREPARED_LEAF_CLASS);
  if (projective) {
    delete attributes[PROJECTION[0]];
    if (!names.includes(PREPARED_LEAF_CLASS)) names = [...names, PREPARED_LEAF_CLASS];
    const bordered = [...keptStatics, ...keptProperties].some(entry => sides(entry.name));
    for (const [idl, value] of Object.entries({ ...PREPARED_LEAF_RULE, ...bordered ? {} : LEAF_NO_OPS })) {
      const name = preparedPropertyName({ name: idl, custom: false }), covering = [name, ...SHORTHANDS[name]!];
      const setters = [...keptStatics, ...keptProperties].filter(entry => covering.includes(entry.name));
      // Only the leaf's own declaration of exactly this value leaves; with another setter it stays, and wins, inline.
      const own = keptProperties.find(entry => entry.name === name && entry.property.value === value);
      if (own && setters.length === 1) keptProperties = keptProperties.filter(entry => entry !== own);
    }
  }
  if (node.tag === 'u') for (const [name, value] of Object.entries(RASTER_TRIANGLE_ATTRIBUTES)) if (attributes[name] === value) delete attributes[name];
  if (keptStatics.length === statics.length) keptStatics = statics;
  const style = keptStatics === statics ? node.style : keptStatics.map(entry => `${entry.text};`).join('');
  const className = names.length ? names.join(' ') : null;
  return { ...node, className: className === (node.className || null) ? node.className : className, style,
    properties: keptProperties.map(entry => entry.id), attributes };
}

/** The tree's clean form; idempotent. The property table is interned again in node order, as the builder's finish writes it. */
export function cleanPreparedTree<T extends Tree>(tree: T): T {
  return interned(tree, tree.nodes.map(node => cleanNode(node, tree.properties)), tree.properties);
}
export function withCleanLeaves<D extends { tree: Tree }>(definition: D): D {
  return { ...definition, tree: cleanPreparedTree(definition.tree) };
}

/** The markers and leaf declarations back inline (the inverse of withCleanLeaves, but for dropped duplicates). */
export function withoutCleanLeaves<D extends { tree: Tree }>(definition: D): D {
  const { tree } = definition, properties = [...tree.properties];
  const nodes = tree.nodes.map(node => {
    if (node.tag === 'u') return { ...node, attributes: { ...RASTER_TRIANGLE_ATTRIBUTES, ...node.attributes } };
    const names = classes(node.className);
    if (!names.includes(PREPARED_LEAF_CLASS)) return node;
    // A declaration the clean form kept inline stays as it is; the others come back as the builder wrote them.
    const present = new Set(node.properties.map(id => preparedPropertyName(properties[id]!)));
    const restored = Object.entries({ ...PREPARED_LEAF_RULE, ...LEAF_NO_OPS })
      .filter(([name]) => !present.has(preparedPropertyName({ name, custom: false })))
      .map(([name, value]) => { properties.push({ name, value, custom: false }); return properties.length - 1; });
    const rest = names.filter(name => name !== PREPARED_LEAF_CLASS);
    return { ...node, className: rest.length ? rest.join(' ') : null, properties: [...node.properties, ...restored],
      attributes: { ...node.attributes, [PROJECTION[0]]: PROJECTION[1] } };
  });
  return { ...definition, tree: interned(tree, nodes, properties) };
}

/** withoutCleanLeaves for a value read from disk: checks the shape it reads before expanding, so a reader needs no cast. */
export function expandCleanLeaves(value: unknown): unknown {
  const record = (item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item);
  if (!record(value) || !record(value.tree) || !Array.isArray(value.tree.nodes) || !Array.isArray(value.tree.properties)) return value;
  return withoutCleanLeaves(value as unknown as { tree: Tree });
}
