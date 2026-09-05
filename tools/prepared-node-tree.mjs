import { applyPreparedProjectiveLayout, scalePreparedBackgroundAddresses, scalePreparedPixelLengths } from "../src/platform/prepared-projective-texture-leaf.mjs";

const cssName = name => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
// Preparation only: these inputs are the checked-in CSS declaration records,
// with no inline semicolons in quoted URLs. Preserve their cascade order.
export function preparedDeclarations(text = "") {
  const values = new Map(), properties = [];
  for (const declaration of text.split(";")) {
    if (!declaration.trim()) continue;
    const colon = declaration.indexOf(":");
    if (colon < 1) throw new TypeError("Prepared CSS declaration is invalid.");
    values.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
  }
  const methods = {
    getPropertyValue: name => values.get(name) ?? "",
    setProperty: (name, value) => { values.set(name, String(value)); properties.push({ name, value: String(value), custom: true }); },
    removeProperty: name => { values.delete(name); properties.push({ name, value: "", custom: true }); },
    preparedRecord: () => ({ style: text, properties: [...properties] }),
  };
  return new Proxy(methods, {
    get(target, name) { if (name === "cssText") return [...values].map(([key, value]) => `${key}:${value}`).join(";"); return target[name] ?? values.get(cssName(name)) ?? ""; },
    set(_target, name, value) { values.set(cssName(name), String(value)); properties.push({ name, value: String(value), custom: false }); return true; },
  });
}

// The preparer resolves grouping, leaf expansion, atlas scaling and final node
// order. Runtime receives only tag/parent/class/style/attribute records.
export function createPreparedNodeTree() {
  const roots = [], created = new Set();
  function element(tag = "div", className = "", style = "", attributes = {}) {
    const node = { tag, className, style: preparedDeclarations(style), attributes: { ...attributes }, children: [], parent: null };
    created.add(node); return node;
  }
  function append(parent, ...nodes) {
    for (const node of nodes) {
      if (!created.has(node) || parent && !created.has(parent) || node.parent || roots.includes(node)) throw new TypeError("Prepared nodes must have one owner.");
      if (node === parent) throw new TypeError("Prepared node cannot own itself.");
      node.parent = parent; (parent ? parent.children : roots).push(node);
    }
  }
  function leaf(prepared, layout = null) {
    const node = element(prepared.tag ?? "s", prepared.className ?? "", prepared.style);
    const layer = prepared.projectiveTextureLayer;
    if (!layer) return node;
    if (layer.schema !== "polycss-prepared-projective-texture-layer@1") throw new TypeError("Prepared projective layer is incompatible.");
    const scale = layer.rasterScale ?? 1;
    applyPreparedProjectiveLayout(node.style, layout, scale);
    const texture = element("span", "polycss-projective-texture", prepared.style);
    applyPreparedProjectiveLayout(texture.style, layout, scale);
    Object.assign(texture.style, { position: "absolute", inset: "0 auto auto 0", display: "block", width: "100%", height: "100%",
      margin: "0", padding: "0", border: "0", lineHeight: "0", textDecoration: "none", transform: `matrix3d(${layer.textureMatrix})`,
      transformOrigin: "0 0", transformStyle: "flat", backfaceVisibility: "visible", backgroundImage: "inherit" });
    scalePreparedBackgroundAddresses(texture.style, scale);
    Object.assign(texture.style, { backgroundRepeat: "no-repeat", backgroundOrigin: "border-box", backgroundClip: "border-box", pointerEvents: "none" });
    node.style.transform = `matrix3d(${layer.frameMatrix})`;
    node.style.transformStyle = "preserve-3d";
    for (const property of ["--polycss-atlas-width", "--polycss-atlas-height"]) {
      const value = node.style.getPropertyValue(property); if (value) node.style.setProperty(property, scalePreparedPixelLengths(value, scale));
    }
    if (node.style.width) node.style.width = scalePreparedPixelLengths(node.style.width, scale);
    if (node.style.height) node.style.height = scalePreparedPixelLengths(node.style.height, scale);
    Object.assign(node.style, { backgroundPosition: "0px 0px", backgroundSize: "0px 0px", backgroundRepeat: "no-repeat" });
    append(node, texture); return node;
  }
  function finish({ camera, scene, registrations, stageClasses = [] }) {
    const nodes = [], indices = new Map(), visiting = new Set();
    function visit(node, parent) {
      if (visiting.has(node) || indices.has(node)) throw new TypeError("Prepared tree contains a cycle or duplicate.");
      visiting.add(node); const index = nodes.length; indices.set(node, index);
      nodes.push({ parent, tag: node.tag, className: node.className, ...node.style.preparedRecord(), attributes: node.attributes });
      for (const child of node.children) visit(child, index);
      visiting.delete(node);
    }
    for (const root of roots) visit(root, -1);
    if (nodes.length !== created.size) throw new TypeError("Prepared tree contains unattached nodes.");
    const index = node => { if (!indices.has(node)) throw new TypeError("Undeclared prepared node reference."); return indices.get(node); };
    return { index, tree: { nodes, camera: index(camera), scene: index(scene), stageClasses,
      registrations: registrations.map(registration => ({ bodySystem: index(registration.bodySystem), lightingOverlays: registration.lightingOverlays.map(index) })) } };
  }
  return { element, mesh: (className, style = "", attributes = {}) => element("div", `polycss-mesh ${className}`, style, attributes), append, leaf, finish };
}
