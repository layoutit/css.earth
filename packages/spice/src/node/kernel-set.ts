/**
 * Load a kernel set in metakernel order: text kernels into one pool, SPKs into
 * the ephemeris, CKs into pointing lookups keyed by instrument, plus leap
 * seconds and spacecraft clocks. Later files take precedence, as in SPICE.
 */
import { sha256 } from '@cssearth/core/node';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseTextKernel, type KernelPool } from '../text-kernel.js';
import { parseLeapSeconds, type LeapSeconds } from '../lsk.js';
import { parseSpacecraftClock, etToClock, type SpacecraftClock } from '../sclk.js';
import { readDaf } from '../daf.js';
import { spkSegments } from '../spk.js';
import { ckSegments, type CkSegment, type Matrix3 } from '../ck.js';
import { Ephemeris } from '../geometry.js';
import { frameDefinition, pckRotation, rotation, type FrameProviders } from '../frames.js';

export interface LoadedKernel { readonly path: string; readonly bytes: number; readonly sha256: string; readonly kind: 'text' | 'spk' | 'ck' }
export interface KernelSet {
  readonly pool: KernelPool; readonly ephemeris: Ephemeris; readonly leapSeconds: LeapSeconds; readonly kernels: readonly LoadedKernel[];
  readonly clock: (spacecraft: number) => SpacecraftClock;
  /** J2000-to-frame rotation at ET through every frame class the set defines. */
  readonly rotation: (frame: string | number, et: number) => Matrix3;
  readonly providers: FrameProviders;
}

/** `ckToleranceSeconds` lets a discrete (type 1) CK answer from its record nearest the requested time, within that many seconds. */
export async function loadKernelSet(paths: readonly string[], { ckToleranceSeconds = 0 }: { ckToleranceSeconds?: number } = {}): Promise<KernelSet> {
  let pool: KernelPool = { variables: new Map(), sources: [] };
  const ephemeris = new Ephemeris(), cks: CkSegment[] = [], kernels: LoadedKernel[] = [], clocks = new Map<number, SpacecraftClock>();
  for (const path of paths) {
    const bytes = await readFile(path), digest = sha256(bytes);
    const kind: LoadedKernel['kind'] = /\.(bsp)$/iu.test(path) ? 'spk' : /\.(bc)$/iu.test(path) ? 'ck' : 'text';
    if (kind === 'spk') ephemeris.load(spkSegments(readDaf(bytes)));
    else if (kind === 'ck') cks.push(...ckSegments(readDaf(bytes)));
    else pool = parseTextKernel(bytes.toString('latin1'), basename(path), pool);
    kernels.push({ path, bytes: bytes.length, sha256: digest, kind });
  }
  const leapSeconds = parseLeapSeconds(pool);
  const clock = (spacecraft: number) => { const id = Math.abs(spacecraft); let c = clocks.get(id); if (!c) { c = parseSpacecraftClock(pool, id); clocks.set(id, c); } return c; };
  const providers: FrameProviders = {
    pck: (body, et) => pckRotation(pool, body, et),
    ck: (instrument, et) => {
      const sclkId = pool.variables.has(`CK_${instrument}_SCLK`) ? Number(pool.variables.get(`CK_${instrument}_SCLK`)?.[0]) : Math.trunc(instrument / 1000);
      const ticks = etToClock(clock(sclkId), leapSeconds, et);
      const tolerance = ckToleranceSeconds > 0 ? etToClock(clock(sclkId), leapSeconds, et + ckToleranceSeconds) - ticks : 0;
      for (let i = cks.length - 1; i >= 0; i--) {
        const segment = cks[i];
        if (segment.instrument !== instrument || ticks < segment.start - tolerance || ticks > segment.stop + tolerance) continue;
        const pointing = segment.pointing(ticks, tolerance);
        if (pointing) return { cMatrix: pointing.cMatrix, reference: segment.reference };
      }
      return null;
    },
  };
  const rotate = (frame: string | number, et: number) => rotation(pool, frame, et, providers);
  ephemeris.frameRotation = (frame, et) => rotate(frameDefinition(pool, frame).id, et);
  return { pool, ephemeris, leapSeconds, kernels, clock, rotation: rotate, providers };
}
