import type { PreparedTree } from '../../src/renderers/css/rendering/prepared-presentation.ts';
import type { PreparedProjectiveLayout, PreparedProjectiveTextureLeaf } from '../../src/renderers/css/prepared-data/projective-layout.ts';
type PreparedProperty = PreparedTree['properties'][number];
type StyleValues = { [K in keyof CSSStyleDeclaration as CSSStyleDeclaration[K] extends string ? K : never]: string };
export type PreparedDeclarations = ReturnType<typeof preparedDeclarations>;
export interface PreparedNode { tag: string; className: string | null; style: PreparedDeclarations; attributes: Record<string, string>; children: PreparedNode[]; parent: PreparedNode | null; }

import { applyPreparedProjectiveLayout, scalePreparedBackgroundAddresses, scalePreparedPixelLengths } from "../../src/renderers/css/dist/preparation.js";

const cssName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
// Preparation only: these inputs are the checked-in CSS declaration records,
// with no inline semicolons in quoted URLs. Preserve their cascade order.
export function preparedDeclarations(text = "", nativeReads: Readonly<Record<string, string>> | null = null) {
  const values = new Map<string, string>(), properties: PreparedProperty[] = [];
  const serialized = new Map(Object.entries(nativeReads ?? {}));
  for (const declaration of text.split(";")) {
    if (!declaration.trim()) continue;
    const colon = declaration.indexOf(":");
    if (colon < 1) throw new TypeError("Prepared CSS declaration is invalid.");
    values.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
  }
  const methods = {
    getPropertyValue: (name: string) => values.get(name) ?? "",
    setProperty: (name: string, value: string | number | null) => { values.set(name, String(value)); properties.push({ name, value: String(value), custom: true }); },
    removeProperty: (name: string) => { values.delete(name); properties.push({ name, value: "", custom: true }); },
    preparedRecord: () => ({ style: text, properties: [...properties] }),
  };
  return new Proxy(methods, {
    get(target, name) { if (typeof name !== "string") return Reflect.get(target, name); if (name === "cssText") return [...values].map(([key, value]) => `${key}:${value}`).join(";"); return Reflect.get(target, name) ?? serialized.get(name) ?? values.get(cssName(name)) ?? ""; },
    set(_target, name, value: unknown) { if (typeof name !== "string") return false; serialized.delete(name); values.set(cssName(name), String(value)); properties.push({ name, value: String(value), custom: false }); return true; },
  }) as typeof methods & StyleValues;
}

// The preparer resolves grouping, leaf expansion, atlas scaling and final node
// order. Runtime receives only tag/parent/class/style/attribute records.
export function createPreparedNodeTree({ cssomReads = new Map() }: { cssomReads?: ReadonlyMap<string, Readonly<Record<string, string>>> } = {}) {
  const roots: PreparedNode[] = [], created = new Set<PreparedNode>();
  function element(tag = "div", className: string | null = null, style = "", attributes: Readonly<Record<string, string>> = {}): PreparedNode {
    const node: PreparedNode = { tag, className, style: preparedDeclarations(style, cssomReads.get(style)), attributes: { ...attributes }, children: [], parent: null };
    created.add(node); return node;
  }
  function append(parent: PreparedNode | null, ...nodes: PreparedNode[]) {
    for (const node of nodes) {
      if (!created.has(node) || parent && !created.has(parent) || node.parent || roots.includes(node)) throw new TypeError("Prepared nodes must have one owner.");
      if (node === parent) throw new TypeError("Prepared node cannot own itself.");
      node.parent = parent; (parent ? parent.children : roots).push(node);
    }
  }
  function leaf(prepared: PreparedProjectiveTextureLeaf, layout: PreparedProjectiveLayout | null = null) {
    const node = element(prepared.tag ?? "s", prepared.className || null, prepared.style);
    const layer = prepared.projectiveTextureLayer;
    if (!layer) return node;
    if (layer.schema !== "polycss-prepared-projective-texture-layer@1") throw new TypeError("Prepared projective layer is incompatible.");
    const scale = layer.rasterScale ?? 1;
    applyPreparedProjectiveLayout(node.style, layout, scale);
    // One raster plane owns the complete homography. Splitting the frame and
    // texture into nested composited planes lets Chrome paint outside the leaf
    // under a close perspective camera, even when both DOM rectangles are small.
    // Compose once during preparation; runtime only transports this matrix.
    scalePreparedBackgroundAddresses(node.style, scale);
    node.attributes['data-prepared-projection'] = 'single-leaf';
    const matrix = `matrix3d(${composePreparedTextureMatrices(layer.frameMatrix, layer.textureMatrix)})`;
    node.style.transform = layer.seamOutset ? `${matrix} ${seamOutsetTransform(layer.seamOutset)}` : matrix;
    node.style.transformStyle = "preserve-3d";
    for (const property of ["--polycss-atlas-width", "--polycss-atlas-height"]) {
      const value = node.style.getPropertyValue(property); if (value) node.style.setProperty(property, scalePreparedPixelLengths(value, scale));
    }
    if (node.style.width) node.style.width = scalePreparedPixelLengths(node.style.width, scale);
    if (node.style.height) node.style.height = scalePreparedPixelLengths(node.style.height, scale);
    Object.assign(node.style, { backgroundRepeat: "no-repeat", backgroundOrigin: "border-box", backgroundClip: "border-box", pointerEvents: "none" });
    return node;
  }
  function finish({ camera, scene, stageClasses = [] }: { camera: PreparedNode; scene: PreparedNode; stageClasses?: string[] }) {
    const nodes: PreparedTree['nodes'][number][] = [], indices = new Map<PreparedNode, number>(), visiting = new Set<PreparedNode>(), properties: PreparedProperty[] = [], propertyIds = new Map<string, number>();
    const intern = (property: PreparedProperty) => {
      const key=JSON.stringify(property);
      if(!propertyIds.has(key)){propertyIds.set(key,properties.length);properties.push(property);}
      return propertyIds.get(key)!;
    };
    function visit(node: PreparedNode, parent: number) {
      if (visiting.has(node) || indices.has(node)) throw new TypeError("Prepared tree contains a cycle or duplicate.");
      visiting.add(node); const index = nodes.length; indices.set(node, index);
      const prepared=node.style.preparedRecord();
      nodes.push({ parent, tag: node.tag, className: node.className, style:prepared.style,
        properties:prepared.properties.map(intern), attributes: node.attributes });
      for (const child of node.children) visit(child, index);
      visiting.delete(node);
    }
    for (const root of roots) visit(root, -1);
    if (nodes.length !== created.size) throw new TypeError("Prepared tree contains unattached nodes.");
    const index = (node: PreparedNode) => { if (!indices.has(node)) throw new TypeError("Undeclared prepared node reference."); return indices.get(node)!; };
    return { index, tree: { nodes, properties, camera: index(camera), scene: index(scene), stageClasses } };
  }
  return { element, mesh: (className: string, style = "", attributes: Readonly<Record<string, string>> = {}) => element("div", `polycss-mesh ${className}`, style, attributes), append, leaf, finish };
}

// Scale about the leaf centre by `1 + outset × scale` per axis. The outset is the
// silhouette-stepped custom property the body publishes; before a step, 0 keeps exact tiling.
function seamOutsetTransform({ property, scale }: { property: string; scale: readonly number[] }) {
  if (!/^--[a-z][a-z0-9-]*$/u.test(property) || scale.length !== 2 || scale.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new TypeError("Prepared seam outset is invalid.");
  }
  const axis = (value: number) => `calc(1 + var(${property}, 0) * ${value})`;
  return `translate(50%, 50%) scale(${axis(scale[0])}, ${axis(scale[1])}) translate(-50%, -50%)`;
}

function composePreparedTextureMatrices(frameValue: string | readonly number[], textureValue: string | readonly number[]) {
  const parse = (value: string | readonly number[]) => {
    const matrix = String(value).split(',').map(Number);
    if (matrix.length !== 16 || matrix.some(value => !Number.isFinite(value))) throw new TypeError('Prepared projective texture matrix is invalid.');
    return matrix;
  };
  const frame = parse(frameValue), texture = parse(textureValue);
  return Array.from({ length: 16 }, (_, index) => {
    const row = index % 4, column = Math.floor(index / 4);
    return [0, 1, 2, 3].reduce((sum, inner) => sum + frame[inner * 4 + row] * texture[column * 4 + inner], 0);
  }).join(',');
}
