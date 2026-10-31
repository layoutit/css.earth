/** How far a cell's contents sit from their true places when its board never turns: at the real views, from the drawn axes. */
import { cssCameraAxesFromOrientation, presentPhysicalPoseInVolume } from '@cssearth/engine';
import { add, dot, mul, type V3 } from '../geometry.mts';
import { pilotCamera } from '../piece-pilot/cameras.mts';
import { buildAll } from './dots-all.mts';
const { all, axes, frame } = await buildAll();
const entries = { direct: { orientation: [0.47893, 0.10019, 0.51941, 0.70058] }, savedEarth: { orientation: [0.09929, 0.15239, -0.89267, 0.41238] } };
const local = (q: number[]) => { const r = cssCameraAxesFromOrientation(presentPhysicalPoseInVolume({ positionM: [frame.originM[0] + 1e20, frame.originM[1], frame.originM[2]] as never, orientationXyzw: (() => { const n = Math.hypot(...q); return q.map(v => v / n); })() as never } as never, frame).orientationXyzw); return { right: [r[0], r[3], r[6]] as V3, up: [-r[1], -r[4], -r[7]] as V3 }; };
const views: [string, { right: V3; up: V3 }][] = [['earth', local(entries.savedEarth.orientation)], ['opening', local(entries.direct.orientation)], ['face', pilotCamera('a', 128, [0, 0, 0], 10, 0, 0)], ['tilt45', pilotCamera('a', 128, [0, 0, 0], 10, 45, 0)], ['edge', pilotCamera('a', 128, [0, 0, 0], 10, 90, 0)]];
const out: Record<string, unknown> = {};
for (const [name, v] of views) { const errors: number[] = []; for (const { board } of all) for (const d of board.dots) { const off = add(d.at, mul(board.center, -1)); errors.push(Math.hypot(dot(off, axes.right) - dot(off, v.right), dot(off, axes.up) - dot(off, v.up))); } errors.sort((a, b) => a - b); out[name] = { worstKpc: +errors.at(-1)!.toFixed(3), p99Kpc: +errors[Math.floor(errors.length * .99)]!.toFixed(3), medianKpc: +errors[errors.length >> 1]!.toFixed(3) }; }
console.log('GAS_TILT ' + JSON.stringify(out));
