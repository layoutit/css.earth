/** Shared temporary Python transport and validated authoring options; no Python checkout dependency. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import * as P from './galaxy-physics.mts';

export const PYTHON_SOURCES: Readonly<Record<string,string>> = {
 'physics8.py':P.PHYSICS,'native_local8.py':P.NATIVE_LOCAL,
 'scatter8_prepare.py':P.SCATTER,'scatter_kernels.py':P.SCATTER_KERNELS,
};

export function writePythonSources(directory: string, extra: Readonly<Record<string, string>> = {}): void {
  for (const [name, source] of Object.entries({ ...PYTHON_SOURCES, ...extra })) {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
    writeFileSync(join(directory, name), source);
  }
}

export function runGalaxyPython(script: string, args: readonly string[], env: NodeJS.ProcessEnv = {}, extra: Readonly<Record<string, string>> = {}): void {
  const python = process.env.CSSEARTH_TORCH_PYTHON;
  if (!python) throw new Error('Set CSSEARTH_TORCH_PYTHON to Python with NumPy and Pillow; raw-field composition also needs PyTorch and SciPy.');
  const directory = mkdtempSync(join(tmpdir(), 'galaxy-b30-'));
  try {
    writePythonSources(directory, extra);
    const run = spawnSync(python, [join(directory, script), ...args], { stdio: 'inherit', env: {
      ...process.env, ...env, PYTHONPATH: directory, GALAXY8_CODE: directory,
      PYTHONDONTWRITEBYTECODE: '1', CUBLAS_WORKSPACE_CONFIG: ':4096:8',
    } });
    if (run.status !== 0) throw new Error(`galaxy ${script}: ${run.error?.message ?? `exit ${run.status}`}`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export const PHYSICS_CHOICES: Readonly<Record<string, readonly string[]>> = {
  discHeights: ['exp', 'sech2old'], dustRef: ['a0', 'r'], localSharpen: ['off', 'on'],
  dustField: ['physical', 'legacy'], gaiaModel: ['population', 'legacy'], scatter: ['on', 'off'],
  slabTransfer: ['mixed', 'midpoint'], localSampling: ['native', 'grid'], scatterViews: ['faceSide', 'all'],
};
const PATHS = ['arms','local','smooth','textured','vergely','scatterCalibration','illuminationFit'];
const NUMBERS = ['fadeIn','fadeOut','vergelyFade','hole','hR','hRthick','youngHz','youngHR','zSun','gradIn','gradOut','skyWidth','skyPer','farContrast','sideSlabs','nativeStepPc'];
const INTEGER = new Set(['skyWidth','skyPer','sideSlabs']);
const POSITIVE = new Set(['hR','hRthick','youngHz','skyWidth','skyPer','sideSlabs','nativeStepPc','farContrast']);
export function preparationOptions(options:readonly string[]):string[] {
 const seen=new Set<string>();
 return options.map(option=>{
  const at=option.indexOf('='),name=option.slice(2,at),value=option.slice(at+1);
  if(!option.startsWith('--')||at<3||!value||seen.has(name))throw new TypeError('Invalid or repeated composition option: '+option);
  seen.add(name);
  if(PATHS.includes(name))return '--'+name+'='+resolve(value);
  if(PHYSICS_CHOICES[name]) {if(!PHYSICS_CHOICES[name]!.includes(value))throw new TypeError('Invalid physical choice: '+option);}
  else if(name==='views') {if(!value.split(',').every(v=>['face','side','sun','allsky'].includes(v)))throw new TypeError('Invalid composition views');}
  else {const n=Number(value);if(!NUMBERS.includes(name)||!Number.isFinite(n)||INTEGER.has(name)&&!Number.isInteger(n)||POSITIVE.has(name)&&n<=0)throw new TypeError('Invalid composition option: '+option);}
  return option;
 });
}
