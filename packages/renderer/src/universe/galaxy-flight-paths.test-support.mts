import { readFile } from 'node:fs/promises';
import { cameraPoseToReferenceFrame, type WorldCameraPose } from '@cssearth/engine';
import type { DensityVolumeFrame, VolumeVector } from '@cssearth/objects';
export const LY_M = 9.4607304725808e15;
export interface FlightPath { name: string; approach: boolean; cameras: WorldCameraPose[] }
export function directedPose(position: VolumeVector, direction: VolumeVector, frame: DensityVolumeFrame): WorldCameraPose {
  const length = Math.hypot(...direction), [x, y, z] = direction.map(v => v / length);
  const q = z! < -.999999999 ? [0, 1, 0, 0] as const : [-y! / Math.sqrt(2 * (1 + z!)), x! / Math.sqrt(2 * (1 + z!)), 0, Math.sqrt((1 + z!) / 2)] as const;
  return { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: cameraPoseToReferenceFrame({ positionM: position.map(v => v * frame.metersPerUnit) as [number, number, number], orientationXyzw: q }, frame) };
}
export async function galaxyFlightPaths(frame: DensityVolumeFrame): Promise<FlightPath[]> {
  const paths: FlightPath[] = [], center = frame.boundsUnits.min.map((v, i) => (v + frame.boundsUnits.max[i]!) / 2);
  for (const [name, dir] of Object.entries({ above: [0, 0, 1], below: [0, 0, -1], '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 1, 0], '-Y': [0, -1, 0], anticentre: [-.7, -.7, .14] })) {
    const direction = dir.map(v => v / Math.hypot(...dir)) as [number, number, number];
    const cameras: WorldCameraPose[] = [];
    for (let ly = 110000; ly > .000000736; ly *= .99) cameras.push(directedPose(direction.map(v => v * ly * LY_M / frame.metersPerUnit) as [number, number, number], direction, frame));
    cameras.push(directedPose(direction.map(v => v * .000000736 * LY_M / frame.metersPerUnit) as [number, number, number], direction, frame));
    paths.push({ name: 'approach-' + name, approach: true, cameras });
  }
  for (const ly of [110000, 60000, 30000, 19000]) for (const kind of ['elevation', 'azimuth']) {
    const cameras: WorldCameraPose[] = [];
    for (let angle = 0; angle <= (kind === 'elevation' ? 90 : 360); angle += .01) {
      const el = (kind === 'elevation' ? angle : 8) * Math.PI / 180, az = (kind === 'azimuth' ? angle : 24) * Math.PI / 180;
      const direction: VolumeVector = [Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), Math.sin(el)];
      cameras.push(directedPose(direction.map((v, i) => center[i]! + v * ly * LY_M / frame.metersPerUnit) as [number, number, number], direction, frame));
    }
    paths.push({ name: kind + '-' + ly, approach: false, cameras });
  }
  // Historical owner cameras are evidence inputs, never an alternative renderer.
  const owners: unknown = JSON.parse(await readFile(new URL('./galaxy-flight-owner-cameras.fixture.json', import.meta.url), 'utf8'));
  if (!Array.isArray(owners)) throw new TypeError('Owner cameras missing');
  for (const entry of owners) {
    const value: unknown = entry;
    if (typeof value !== 'object' || value === null || !('name' in value) || typeof value.name !== 'string' ||
      !('positionUnits' in value) || !('orientationXyzw' in value)) throw new TypeError('Invalid owner camera');
    const vector = (input: unknown, count: number): number[] => {
      if (!Array.isArray(input) || input.length !== count || !input.every(v => typeof v === 'number' && Number.isFinite(v))) throw new TypeError('Invalid camera vector');
      return input.map(Number);
    };
    const p = vector(value.positionUnits, 3), q = vector(value.orientationXyzw, 4);
    if (Math.abs(Math.hypot(...q) - 1) > 1e-8) throw new TypeError('Camera quaternion is not normalized');
    paths.push({ name: value.name, approach: false, cameras: [{ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: cameraPoseToReferenceFrame({ positionM: [p[0]! * frame.metersPerUnit, p[1]! * frame.metersPerUnit, p[2]! * frame.metersPerUnit],
        orientationXyzw: [q[0]!, q[1]!, q[2]!, q[3]!] }, frame) }] });
  }
  return paths;
}
