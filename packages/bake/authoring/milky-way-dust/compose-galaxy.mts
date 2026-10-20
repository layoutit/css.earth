// Entry script: CSSEARTH_TORCH_PYTHON=<CUDA Python> node packages/bake/authoring/milky-way-dust/compose-galaxy.mts <work> <out> <fit.json> <views.json> [preparation options] [--box=x0,x1,y0,y1,z0,z1 --dxy=.1 --dz=.03 --logK=1e6]
/**
 * The composed 3D object KEEPER, adapted from compose3d.py for b30's physical fields.
 * Default: three nested bricks, outer (GC ±25 kpc, z ±3, .2/.1 kpc cells),
 * disc (GC ±16 kpc, z ±1.5, .04/.025 cells), local (Sun ±1.25 kpc, .004 cells).
 * --box, --boxR or --boxZ requests one custom brick; --dxy/--dz override spacing.
 * Bricks replace one another: use the finest resident brick at each point, never add overlapping densities.
 * Stellar discs are analytic on the entire box; bar, arms and far dust are zero outside their source grid.
 * Native local dust is sampled from its own lattice, without projected sharpening or added detail texture.
 * Fitted physics and saved structure must match the supplied prepared views; source paths can be relocated.
 * Projected legacy sharpening cannot define a 3D object and fails explicitly when its fitted strength is nonzero.
 *
 * Output format (the next PolyCSS bake consumes these LOCAL files):
 * object.json: schema cssearth-composed-galaxy@1, record, bricks in coarse-to-fine priority order.
 * Each brick: meta.json, dims=[nx,ny,nz], originKpc at the first node, spacingKpc,
 * Sun-centered Galactic Cartesian (+X toward GC at 8.277 kpc, +Y toward l=90°, +Z north).
 * emission.f32: intrinsic z,r,g emission per kpc, before the fitted camera.
 * dust.f32: scalar A_r per kpc after each source's CCM89 reference conversion.
 * scatter.f32: z,r,g in-scattered source per kpc; use only for observables allowed by scatterViews.
 * All floats: little-endian float32, C order z,y,x,channel, x fastest (dust has one channel).
 * meta.extinctionPerChannel converts A_r to z,r,g optical depth per kpc; extinction is unchanged by scatterViews.
 * Integrate physical bands with the saved slabTransfer, then apply meta.camera ONCE after transfer.
 * nearLight is a NASA catalog-selection nuisance; it is recorded but not applied to the 3D object.
 * volume.rgba8: lossy preview, RGB intrinsic bands and A dust; log decode
 * x=max*(expm1(byte/255*log1p(K))/K), K=meta.encoding.log1pK. Quantile clipping is preview-only.
 * detail.r8/detail.json are produced separately by dust-detail.mts; never add detail twice to native dust.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMPOSE } from './galaxy-compose-source.mts';
import { preparationOptions, runGalaxyPython } from './galaxy-python.mts';

export function compositionOptions(options: readonly string[]): string[] {
  const geometry: string[] = [], preparation: string[] = [];
  for (const option of options) {
    const at = option.indexOf('='), key = option.slice(2, at < 0 ? undefined : at), value = option.slice(at + 1);
    if (key === 'splitEmission') {
      if (!['on', 'off'].includes(value)) throw new TypeError('splitEmission must be on or off.');
      geometry.push(option);
    } else if (key === 'box') {
      const box = value.split(',').map(Number);
      if (at < 0 || box.length !== 6 || !box.every(Number.isFinite) || box.some((v, i) => i % 2 === 0 && v >= box[i + 1]!)) throw new TypeError('box requires six ordered finite bounds.');
      geometry.push(option);
    } else if (['boxR', 'boxZ', 'dxy', 'dz', 'logK'].includes(key)) {
      if (at < 0 || value === '' || !Number.isFinite(Number(value)) || Number(value) <= 0) throw new TypeError(`Invalid --${key}.`);
      geometry.push(option);
    } else preparation.push(option);
  }
  return [...preparationOptions(preparation), ...geometry];
}

export function main(argv: readonly string[]): void {
  const positional = argv.filter(a => !a.startsWith('--'));
  if (positional.length !== 4) throw new TypeError('Usage: compose-galaxy.mts <work> <out> <fit.json> <views.json> [options]');
  const [work, out, fit, views] = positional.map(p => resolve(p));
  const options = compositionOptions(argv.filter(a => a.startsWith('--')));
  const custom = options.some(a => /^--box(?:R|Z)?=/u.test(a));
  const bricks = custom ? [{ name: 'custom', options: [] as string[] }] : [
    { name: 'outer', options: ['--boxR=25', '--boxZ=3', '--dxy=0.2', '--dz=0.1'] },
    { name: 'disc', options: ['--boxR=16', '--boxZ=1.5', '--dxy=0.04', '--dz=0.025'] },
    { name: 'local', options: ['--box=-1.25,1.25,-1.25,1.25,-1.25,1.25', '--dxy=0.004', '--dz=0.004'] },
  ];
  mkdirSync(out!, { recursive: true });
  const records: { path: string; metadata: unknown }[] = [];
  for (const brick of bricks) {
    const directory = custom ? out! : resolve(out!, brick.name);
    const defaults = brick.options.filter(a => !options.some(o => o.split('=')[0] === a.split('=')[0]));
    runGalaxyPython('compose3d.py', [work!, directory, fit!, views!, ...defaults, ...options], {}, { 'compose3d.py': COMPOSE });
    const metadata: unknown = JSON.parse(readFileSync(resolve(directory, 'meta.json'), 'utf8'));
    if (typeof metadata !== 'object' || metadata === null || !('dims' in metadata) || !Array.isArray(metadata.dims)
      || metadata.dims.length !== 3 || !metadata.dims.every(n => typeof n === 'number' && Number.isInteger(n) && n > 0)) throw new TypeError('Invalid composed dimensions.');
    const voxels = metadata.dims.reduce((a: number, b: number) => a * b, 1);
    for (const [name, bytes] of [['volume.rgba8', 4], ['emission.f32', 12], ['dust.f32', 4], ['scatter.f32', 12]] as const) {
      if (statSync(resolve(directory, name)).size !== voxels * bytes) throw new Error(`Composed ${name} has the wrong byte count.`);
    }
    if (options.includes('--splitEmission=on')) for (const name of ['smooth.f32', 'sharp.f32']) {
      if (statSync(resolve(directory, name)).size !== voxels * 12) throw new Error(`Composed ${name} has the wrong byte count.`);
    }
    records.push({ path: custom ? '.' : brick.name, metadata });
  }
  writeFileSync(resolve(out!, 'object.json'), JSON.stringify({ schema: 'cssearth-composed-galaxy@1', record: fit,
    overlap: 'Finest brick replaces coarser fields; never sum overlapping bricks.', bricks: records }, null, 2) + '\n');
  console.log('COMPOSED GALAXY COMPLETE', out);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
