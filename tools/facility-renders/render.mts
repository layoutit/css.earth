import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { loadVoyager } from './voyager.mts';
import { inwardDirection, type FacilityPose } from './poses.mts';

export interface RenderRequest {
  id: string;
  url: string;
  direction: [number, number, number];
  rollDegrees: number;
  usda: boolean;
  pose?: FacilityPose;
}

/** Illustration lights, in camera coordinates. Never mission-specific illumination. */
export const recipe = {
  name: 'Sunlit inward-facing facility thumbnails v4', renderer: 'Three.js 0.180.0', preparationOnly: true,
  masterSize: [1200, 600], outputSize: [592, 296],
  materials: 'Original source materials and textures; no artistic overrides.',
  toneMapping: 'ACESFilmic', exposure: 1,
  environment: {
    name: 'Space: black sky, a small sun disc behind the key light and a faint blue planet glow below',
    blur: 0.02, intensity: 1,
    sun: { position: [-3, 4, 6], radius: 0.9, radiance: 40 },
    glow: { position: [2, -6, 1], radius: 22, color: '#5f7fa8', radiance: 0.5 },
  },
  lights: [
    { role: 'key', intensity: 4.2, position: [-3, 4, 6], shadows: true, color: '#fff6ea' },
    { role: 'fill', intensity: 0.3, position: [2, -1, 4], shadows: false, color: '#9fb6d8' },
    { role: 'rim', intensity: 1.2, position: [4, 2, -4], shadows: false, color: '#ffffff' },
  ],
  shadowMapSize: 2048,
  framing: 'Centered orthographic; fit retained geometry within 88% width / 86% height.',
  camera: { position: [0, 0, 10], up: [0, 1, 0], rollDegrees: 0 },
  orientation: { poses: 'tools/facility-renders/poses.mts', inwardDirection, policy: 'Rotate the model before lighting. Aim the prominent dish or camera opening inward; an illustrative pose, not flight attitude.' },
};

/** Connected components welded by position, used only for reviewed source-specific omissions. */
export function components(geometry: T.BufferGeometry) {
  const a = geometry.getAttribute('position');
  const ids = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: a.count }, (_, i) => i);
  const parent = Array.from({ length: a.count }, (_, i) => i), weld = new Map<string, number>();
  const find = (value: number): number => {
    while (parent[value] !== value) { parent[value] = parent[parent[value]]; value = parent[value]; }
    return value;
  };
  const join = (x: number, y: number) => { parent[find(y)] = find(x); };
  for (let i = 0; i < a.count; i++) {
    const key = [a.getX(i), a.getY(i), a.getZ(i)].map(v => Math.round(v * 10000)).join(',');
    const previous = weld.get(key);
    if (previous === undefined) weld.set(key, i); else join(i, previous);
  }
  for (let i = 0; i < ids.length; i += 3) { join(ids[i], ids[i + 1]); join(ids[i], ids[i + 2]); }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < a.count; i++) { const id = find(i); const group = groups.get(id) ?? []; group.push(i); groups.set(id, group); }
  const parts = [...groups].map(([id, indices]) => {
    const points = indices.map(i => new T.Vector3().fromBufferAttribute(a, i));
    const farthest = (from: T.Vector3) => points.reduce((best, p) => p.distanceToSquared(from) > best.distanceToSquared(from) ? p : best, points[0]);
    const start = farthest(points[0]), end = farthest(start), axis = end.clone().sub(start).normalize();
    let radius = 0;
    for (const point of points) radius = Math.max(radius, point.clone().sub(start).cross(axis).length());
    return { id, vertices: indices.length, length: start.distanceTo(end), radius };
  });
  return { ids, find, parts };
}

/** Emissive spheres on black: reflections see the sun and a faint planet, not a lit room. */
function spaceEnvironment() {
  const room = new T.Scene(), { sun, glow } = recipe.environment;
  for (const { position, radius, color, radiance } of [{ ...sun, color: '#ffffff' }, glow]) {
    const mesh = new T.Mesh(new T.SphereGeometry(radius, 32, 16), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(radiance) }));
    mesh.position.fromArray(position).normalize().multiplyScalar(40); room.add(mesh);
  }
  return Object.assign(room, { dispose: () => room.traverse(node => { if (node instanceof T.Mesh) { node.geometry.dispose(); node.material.dispose(); } }) });
}

export async function renderFacility(request: RenderRequest) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(1200, 600); renderer.setClearColor(0, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = recipe.exposure;
  const scene = new T.Scene(), pmrem = new T.PMREMGenerator(renderer), room = spaceEnvironment();
  const environment = pmrem.fromScene(room, recipe.environment.blur);
  scene.environment = environment.texture; scene.environmentIntensity = recipe.environment.intensity;
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const model = request.usda ? await loadVoyager(request.url) : (await new GLTFLoader().setDRACOLoader(draco).loadAsync(request.url)).scene;
  const omissions: { mesh: string; components: number[]; triangles: number }[] = [];
  try {
    if (request.id === 'cassini') {
      const node = model.getObjectByName('aluminum');
      if (!(node instanceof T.Mesh)) throw new Error('Cassini aluminum mesh missing');
      const { ids, find, parts } = components(node.geometry);
      const selected = parts.filter(p => p.length > 10 && p.radius < 0.1);
      if (selected.length !== 3 || selected.map(p => p.vertices).sort().join(',') !== '36,36,42') throw new Error('Cassini antenna identity changed');
      const excluded = new Set(selected.map(p => p.id)), kept: number[] = [];
      for (let i = 0; i < ids.length; i += 3) if (!excluded.has(find(ids[i]))) kept.push(ids[i], ids[i + 1], ids[i + 2]);
      if ((ids.length - kept.length) / 3 !== 50) throw new Error('Cassini antenna triangle count changed');
      node.geometry = node.geometry.clone(); node.geometry.setIndex(kept);
      omissions.push({ mesh: node.name, components: [...excluded], triangles: 50 });
    }
    const bounds = new T.Box3().setFromObject(model), size = bounds.getSize(new T.Vector3());
    if (bounds.isEmpty()) throw new Error(`No model geometry: ${request.id}`);
    const assembly = new T.Group(); model.position.sub(bounds.getCenter(new T.Vector3()));
    assembly.add(model); assembly.scale.setScalar(4 / Math.max(size.x, size.y, size.z)); scene.add(assembly);
    const materials: { mesh: string; material: string; type: string; metalness?: number; roughness?: number; texture: boolean }[] = [];
    let triangles = 0;
    model.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      node.castShadow = true; node.receiveShadow = true;
      triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.push({ mesh: node.name, material: material.name, type: material.type,
          ...(material instanceof T.MeshStandardMaterial ? { metalness: material.metalness, roughness: material.roughness } : {}),
          texture: 'map' in material && !!material.map });
      }
    });
    const [x, y, z] = request.direction;
    const camera = new T.OrthographicCamera(-4, 4, 2, -2, 0.01, 100);
    if (request.pose) {
      camera.up.fromArray(recipe.camera.up); camera.position.fromArray(recipe.camera.position);
      assembly.quaternion.fromArray(request.pose.modelQuaternion);
    } else if (request.usda) { camera.up.set(0, 1, 0); camera.position.set(x, y, z); }
    else { camera.up.set(0, 0, -1); camera.position.set(x, z, -y); }
    camera.position.normalize().multiplyScalar(10);
    if (Math.abs(camera.position.clone().normalize().dot(camera.up)) > 0.99) camera.up.set(0, 1, 0);
    const rollDegrees = request.pose ? 0 : request.rollDegrees;
    camera.lookAt(0, 0, 0); camera.rotateZ(T.MathUtils.degToRad(rollDegrees));
    camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    const point = new T.Vector3();
    model.traverseVisible(node => {
      if (!(node instanceof T.Mesh)) return;
      const positions = node.geometry.getAttribute('position');
      const geometry: T.BufferGeometry = node.geometry;
      const ids = geometry.index ? new Set(geometry.index.array) : Array.from({ length: positions.count }, (_, i) => i);
      for (const i of ids) {
        point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        minx = Math.min(minx, point.x); maxx = Math.max(maxx, point.x); miny = Math.min(miny, point.y); maxy = Math.max(maxy, point.y);
      }
    });
    const height = Math.max((maxy - miny) / 0.86, (maxx - minx) / 1.76), width = height * 2;
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    Object.assign(camera, { left: cx - width / 2, right: cx + width / 2, top: cy + height / 2, bottom: cy - height / 2 }); camera.updateProjectionMatrix();
    for (const spec of recipe.lights) {
      const light = new T.DirectionalLight(spec.color, spec.intensity);
      light.position.fromArray(spec.position).applyQuaternion(camera.quaternion); light.castShadow = spec.shadows;
      if (spec.shadows) {
        light.shadow.mapSize.set(2048, 2048);
        Object.assign(light.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 30 });
        light.shadow.normalBias = 0.007; light.shadow.bias = -0.00005;
      }
      scene.add(light);
    }
    renderer.render(scene, camera);
    const geometryReview: { mesh: string; center: number[]; size: number[] }[] = [];
    model.traverse(node => {
      if (!(node instanceof T.Mesh) || !node.geometry.getAttribute('position')?.count) return;
      const box = new T.Box3().setFromObject(node);
      geometryReview.push({ mesh: node.name, center: box.getCenter(new T.Vector3()).toArray(), size: box.getSize(new T.Vector3()).toArray() });
    });
    const pose = request.pose ? { ...request.pose, renderedDirection: new T.Vector3(...request.pose.sourceAxis).applyQuaternion(assembly.quaternion).normalize().toArray() } : null;
    return { png: renderer.domElement.toDataURL('image/png'), report: { id: request.id, triangles, materials, omissions, geometryReview, pose, camera: { direction: camera.position.toArray(), up: camera.up.toArray(), rollDegrees } } };
  } finally {
    model.traverse(node => { if (node instanceof T.Mesh) { node.geometry.dispose(); for (const m of Array.isArray(node.material) ? node.material : [node.material]) { for (const v of Object.values(m)) if (v instanceof T.Texture) v.dispose(); m.dispose(); } } });
    environment.dispose(); room.dispose(); pmrem.dispose(); draco.dispose(); renderer.dispose(); renderer.forceContextLoss();
  }
}
