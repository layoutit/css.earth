import * as T from 'three';

// The pinned Voyager USDZ uses USDC, which Three's USDLoader does not implement.
// usdcat exposes its source arrays as USDA. This bounded reader retains all four
// meshes (including two siblings in tex_01), transforms, UVs and material values.
type Block = { name: string; values: Map<string, string>; children: Block[] };
function parse(text: string): Block {
  const root: Block = { name: '', values: new Map(), children: [] }, stack = [root];
  let pending = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim(), current = stack[stack.length - 1];
    if (line.startsWith('def ')) pending = line;
    else if (line === '{') { const child: Block = { name: pending, values: new Map(), children: [] }; current.children.push(child); stack.push(child); }
    else if (line === '}') stack.pop();
    else { const equals = line.indexOf(' = '); if (equals >= 0) current.values.set(line.slice(0, equals), line.slice(equals + 3).replace(/ \($/, '')); }
  }
  if (stack.length !== 1) throw new Error('Unbalanced Voyager USDA');
  return root;
}
function numbers(value: string | undefined): number[] {
  if (value === undefined) throw new Error('Missing Voyager numeric source');
  const result: unknown = JSON.parse(value.replace(/[()]/g, '').replace(/^([^\[])/, '[$1').replace(/([^\]])$/, '$1]'));
  if (!Array.isArray(result) || !result.every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('Invalid Voyager numeric array');
  return result;
}
const name = (block: Block) => { const value = /"([^"]+)"/.exec(block.name)?.[1]; if (!value) throw new Error('Unnamed Voyager block'); return value; };

export async function loadVoyager(url: string): Promise<T.Group> {
  const response = await fetch(url); if (!response.ok) throw new Error('Voyager USDA unavailable');
  const root = parse(await response.text()), scope = root.children.find(b => b.name === 'def Scope "Materials"');
  if (!scope) throw new Error('Missing Voyager materials');
  const materials = new Map<string, T.MeshStandardMaterial>();
  for (const block of scope.children) {
    const shader = block.children.find(b => b.values.get('uniform token info:id') === '"UsdPreviewSurface"');
    if (!shader) throw new Error('Unsupported Voyager material');
    const material = new T.MeshStandardMaterial(); material.name = name(block);
    material.metalness = numbers(shader.values.get('float inputs:metallic'))[0];
    material.roughness = numbers(shader.values.get('float inputs:roughness'))[0];
    if (shader.values.has('color3f inputs:diffuseColor')) material.color.fromArray(numbers(shader.values.get('color3f inputs:diffuseColor')));
    const textureShader = block.children.find(b => b.values.get('uniform token info:id') === '"UsdUVTexture"');
    if (textureShader) {
      const asset = textureShader.values.get('asset inputs:file'), file = asset?.match(/\[(0\/image[0-2]\.jpg)\]@$/)?.[1];
      if (!file) throw new Error('Unrecognized Voyager texture');
      material.map = await new T.TextureLoader().loadAsync(new URL(file, url).href); material.map.colorSpace = T.SRGBColorSpace;
    }
    materials.set(name(block), material);
  }
  const model = new T.Group(); let meshCount = 0;
  const add = (block: Block, parent: T.Object3D) => {
    let node: T.Object3D;
    if (block.name.startsWith('def Mesh ')) {
      const counts = numbers(block.values.get('int[] faceVertexCounts'));
      if (!counts.every(v => v === 3)) throw new Error('Voyager contains unsupported non-triangle faces');
      const indices = numbers(block.values.get('int[] faceVertexIndices')), positions = numbers(block.values.get('point3f[] points'));
      if (indices.length !== counts.length * 3 || indices.some(i => !Number.isInteger(i) || i < 0 || i * 3 >= positions.length)) throw new Error('Invalid Voyager topology');
      const geometry = new T.BufferGeometry(); geometry.setIndex(indices); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      if (block.values.has('normal3f[] normals')) { const normals = numbers(block.values.get('normal3f[] normals')); if (normals.length !== positions.length) throw new Error('Unexpected Voyager normals'); geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); } else geometry.computeVertexNormals();
      if (block.values.has('texCoord2f[] primvars:st0')) { const uv = numbers(block.values.get('texCoord2f[] primvars:st0')); if (uv.length * 3 !== positions.length * 2) throw new Error('Unexpected Voyager UVs'); geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); }
      const binding = block.values.get('rel material:binding')?.match(/^<\/Materials\/([^>]+)>$/)?.[1], material = binding && materials.get(binding);
      if (!material) throw new Error('Missing Voyager material binding');
      node = new T.Mesh(geometry, material); meshCount++;
    } else node = new T.Group();
    node.name = name(block);
    if (block.values.has('matrix4d xformOp:transform')) { node.matrix.fromArray(numbers(block.values.get('matrix4d xformOp:transform'))); node.matrix.decompose(node.position, node.quaternion, node.scale); }
    if (block.values.has('float3 xformOp:scale')) node.scale.fromArray(numbers(block.values.get('float3 xformOp:scale')));
    parent.add(node);
    for (const child of block.children) if (/^def (Xform|Mesh) /.test(child.name)) add(child, node);
  };
  for (const block of root.children) if (block.name.startsWith('def Xform ')) add(block, model);
  if (meshCount !== 4 || materials.size !== 4) throw new Error('Voyager source structure changed');
  return model;
}
