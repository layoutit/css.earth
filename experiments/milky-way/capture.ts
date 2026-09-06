/** Offline capture of Galaxio's actual Milky Way shader; never a CSS runtime dependency. */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

type Vec3 = [number, number, number];
type Quaternion = [number, number, number, number];
interface FramePosition { frame: string; offset: Vec3 }
interface Metadata {
  radiusM: number;
  position: FramePosition;
  orientationXyzw: Quaternion;
}
interface CaptureNode {
  name: string;
  type: string;
  visible: boolean;
  position: { toArray(): number[] };
  quaternion: { toArray(): number[] };
}
interface CaptureScene { children: CaptureNode[] }
interface CaptureCamera {
  position: { toArray(): number[] };
  quaternion: { toArray(): number[] };
  fov: number;
  near: number;
  far: number;
}
/** Structural subset of the real DEV engine hook, verified against Galaxio's implementation. */
interface CaptureRuntime {
  setTuning(values: { fovDeg: number; exposureScale: number }): void;
  engine: {
    timeScale: number;
    frame(dt: number): void;
    milkyWay: {
      metadata: Metadata;
      node: CaptureNode;
      weight: number;
      setWeight(value: number): void;
      setFrameIndex(value: number): void;
    } | null;
    navigation: {
      restoreView(focus: { position: FramePosition; radiusM: number; label: string },
        logAltitude: number, azimuth: number, polar: number, lookMode: 'orbit',
        quaternion: null, roll: number): void;
    };
    compositor: { passes: Map<string, { source: { scene: CaptureScene }; camera: CaptureCamera }> };
    renderer: {
      stop(): void;
      report: unknown;
      canvas: { width: number; height: number };
      three: {
        setClearColor(color: number, alpha: number): void;
        clear(): void;
        render(scene: CaptureScene, camera: CaptureCamera): void;
      };
    };
  };
}
type CaptureGlobal = typeof globalThis & { galaxio?: CaptureRuntime };
interface AssetRecord {
  key: string;
  path: string;
  source: string;
  license: string;
  extra: Record<string, unknown>;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function collectAssets(value: unknown, records: AssetRecord[]): void {
  if (!isObject(value)) return;
  if (value.key === 'textures/milky-way-volume' || value.key === 'textures/blue-noise') {
    if (typeof value.path !== 'string' || typeof value.source !== 'string' ||
      typeof value.license !== 'string' || !isObject(value.extra)) throw new Error('Malformed reference asset');
    records.push({ ...value, key: value.key, path: value.path, source: value.source,
      license: value.license, extra: value.extra });
  }
  for (const child of Object.values(value)) collectAssets(child, records);
}

const repoRoot = process.env.CSSEARTH_ROOT ?? fileURLToPath(new URL('../../', import.meta.url));
const root = process.env.MILKY_WAY_ORACLE_ROOT ?? path.join(repoRoot, '.local/milky-way-proof/oracle');
const galaxio = process.env.GALAXIO_ROOT ?? path.resolve(repoRoot, '../galaxio');
const origin = process.env.GALAXIO_ORIGIN ?? 'http://127.0.0.1:4330/';
const readyDeadline = Date.now() + 30_000;
while (true) {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
    if (response.ok) break;
  } catch { /* The private Vite process may still be starting. */ }
  if (Date.now() >= readyDeadline) throw new Error(`Galaxio server did not become ready: ${origin}`);
  await new Promise(resolve => setTimeout(resolve, 250));
}
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
await Promise.all(['bank', 'heldout'].map(dir => mkdir(path.join(root, dir), { recursive: true })));
const browser = await chromium.launch({ headless: true,
  args: ['--enable-unsafe-swiftshader', '--disable-features=WebGPU'] });
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => (globalThis as CaptureGlobal).galaxio?.engine.milkyWay,
    undefined, { timeout: 45000 });
  await page.addStyleTag({ content: '#app main > *:not(.engine-canvas) {display:none!important}' });
  const setup = await page.evaluate(() => {
    const runtime = (globalThis as CaptureGlobal).galaxio;
    if (!runtime?.engine.milkyWay) throw new Error('Galaxio Milky Way hook unavailable');
    const { engine: e, setTuning } = runtime;
    e.renderer.stop();
    e.timeScale = 0;
    setTuning({ fovDeg: 45, exposureScale: 2 });
    const pass = e.compositor.passes.get('galactic');
    if (!pass || !e.milkyWay) throw new Error('Galactic pass unavailable');
    return { metadata: e.milkyWay.metadata, renderer: e.renderer.report,
      canvas: { width: e.renderer.canvas.width, height: e.renderer.canvas.height },
      sceneChildren: pass.source.scene.children.map(node => ({ name: node.name, type: node.type })) };
  });
  const poses = [];
  for (let step = 0; step < 15; step++) {
    const inclinationRad = step * Math.PI / 28;
    const kind = step % 2 ? 'heldout' : 'bank';
    const index = Math.floor(step / 2);
    const pose = await page.evaluate(({ inclinationRad }) => {
      const e = (globalThis as CaptureGlobal).galaxio?.engine;
      if (!e?.milkyWay) throw new Error('Milky Way disappeared');
      const m = e.milkyWay.metadata;
      const v: Vec3 = [Math.sin(inclinationRad), 0, Math.cos(inclinationRad)];
      const [x, y, z] = v;
      const [qx, qy, qz, qw] = m.orientationXyzw;
      const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
      const d: Vec3 = [x + qw * tx + qy * tz - qz * ty,
        y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
      const azimuthRad = Math.atan2(d[0], d[2]), polarRad = Math.acos(d[1]);
      e.navigation.restoreView({ position: m.position, radiusM: 0, label: 'Milky Way' },
        Math.log10(3 * m.radiusM), azimuthRad, polarRad, 'orbit', null, 0);
      e.frame(0);
      const pass = e.compositor.passes.get('galactic');
      if (!pass) throw new Error('Galactic pass disappeared');
      for (const child of pass.source.scene.children) child.visible = child === e.milkyWay.node;
      e.milkyWay.setWeight(1);
      e.milkyWay.setFrameIndex(0);
      const r = e.renderer.three;
      r.setClearColor(0x000000, 1);
      r.clear();
      r.render(pass.source.scene, pass.camera);
      return { inclinationRad, azimuthRad, polarRad, distanceM: 3 * m.radiusM,
        focus: m.position, localDirection: v, frameDirection: d,
        cameraPosition: pass.camera.position.toArray(), cameraQuaternion: pass.camera.quaternion.toArray(),
        fovDeg: pass.camera.fov, near: pass.camera.near, far: pass.camera.far,
        nodePosition: e.milkyWay.node.position.toArray(), nodeQuaternion: e.milkyWay.node.quaternion.toArray(),
        weight: e.milkyWay.weight };
    }, { inclinationRad });
    const file = `${kind}/${String(index).padStart(2, '0')}.png`;
    const bytes = await page.locator('canvas.engine-canvas').screenshot({ path: path.join(root, file) })
      .catch(() => page.locator('canvas').first().screenshot({ path: path.join(root, file) }));
    poses.push({ ...pose, file, sha256: sha(bytes) });
    console.log(`captured ${file} ${(inclinationRad * 180 / Math.PI).toFixed(3)}deg`);
  }
  const records: AssetRecord[] = [];
  const manifest: unknown = JSON.parse(await readFile(path.join(galaxio, 'data/manifest.json'), 'utf8'));
  collectAssets(manifest, records);
  if (records.length !== 2) throw new Error('Expected exactly the volume and blue-noise source records');
  const assets = await Promise.all(records.map(async record => {
    const bytes = await readFile(path.join(galaxio, 'data', record.path));
    const sha256 = sha(bytes);
    if (record.extra.sha256 && record.extra.sha256 !== sha256) throw new Error(`asset pin mismatch: ${record.path}`);
    return { path: record.path, bytes: bytes.length, sha256, manifestSha256: record.extra.sha256 ?? null };
  }));
  const imageChecks = await Promise.all(poses.map(async pose => {
    const stats = await sharp(path.join(root, pose.file)).stats();
    if (stats.channels.slice(0, 3).every(channel => channel.max === 0)) throw new Error(`empty reference: ${pose.file}`);
    return { file: pose.file, channels: stats.channels.map(({ min, max, mean, stdev }) => ({ min, max, mean, stdev })) };
  }));
  const sourceFiles = ['packages/engine/src/scene/milkyWayVolume.ts', 'packages/engine/src/scene/milkyWayModel.ts',
    'packages/engine/src/render/nativeRadianceDisplay.ts', 'packages/engine/src/render/nativeRadianceDisplayModel.ts',
    'packages/engine/src/scene/galaxiumNoiseNodes.ts', 'data/manifest.json'];
  const sources = await Promise.all(sourceFiles.map(async file => ({ file,
    sha256: sha(await readFile(path.join(galaxio, file))) })));
  await writeFile(path.join(root, 'capture.json'), JSON.stringify({ kind: 'real-galaxio-shader-offline-reference',
    referenceStatus: 'Local visual reference only; recovered Galaxium / Stellarium Labs SRL assets and model. All rights reserved. No publication license implied.',
    galaxioCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: galaxio, encoding: 'utf8' }).trim(),
    resolution: 512, setup, background: 'opaque black; no transparent compositing proof',
    sweep: 'local XZ great-circle: +Z face-on to +X edge-on; constant world-up orbit roll',
    frameIndex: 0, exposureScale: 2, records, assets, sources, poses, imageChecks, errors }, null, 2) + '\n');
  console.log(`SUCCESS ${poses.length} reference views and capture.json`);
} finally {
  await browser.close();
}
