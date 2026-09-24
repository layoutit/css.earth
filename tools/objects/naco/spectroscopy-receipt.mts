#!/usr/bin/env node
/** The receipt for a reduced NACO long-slit night: what the two independent halves of the nod set agree on, how wide the
 * target's trace is across the slit against the telluric standard's, and the geometry another stage would need to place a
 * spectral strip on the body.
 *
 *   node tools/objects/naco/spectroscopy-receipt.mts <program id> <work directory>
 *
 * There is no external oracle. ESO publishes no Phase 3 product and no master calibration for NACO, and ESO's own telescope
 * bibliography records no publication for programme 088.C-0833(B) — the two papers it lists for 088.C-0833 are both the
 * SINFONI half of the run. So the checks here are internal and physical:
 *
 * - **Repeatability.** The nod set is split into two disjoint halves, balanced across both nod positions, each reduced on its
 *   own. Their extracted one-dimensional spectra are compared sample by sample.
 * - **Resolved or not.** The programme took a telluric standard through the same slit and grism minutes after the target. A
 *   star is a point source, so its profile across the slit is the instrument's own. A target whose profile is wider is
 *   resolved along the slit; one that is not, is not. This is a measurement and not an inference from an ephemeris.
 *
 * The geometry is read from the frames' own headers and recorded whether or not the target is resolved, because it is what
 * says where on the sky the slit was.
 *
 * The receipt is written to tools/objects/naco/programs/<program id>.spectrum.reproduction.json. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256File } from '@cssearth/core/node';
import { archiveHeader, type EsoHeader } from '../interferometry/eso-pipeline.mts';
import { PROGRAMS, readProgram, type NacoProgram } from './archive.mts';
import { readReduction, type ReductionResult } from './reduce.mts';
import { sampleStatistics as statistics, type Statistics } from '../../fits/sample-statistics.mts';
import { detectSlitAxis, extractSpectrum, measureTrace, readFrame, type TraceMeasurement } from './spectrum.mts';

/** Dispersion samples summed on each side of the trace when a one-dimensional spectrum is extracted. */
export const EXTRACTION_HALF_WIDTH = 6;

export interface SlitGeometry {
  /** Arcseconds per pixel, and the objective that sets it. */
  readonly pixelScaleArcsec: number | null;
  readonly objective: string | null;
  /** The slit and the dispersing element, as the instrument names them. */
  readonly slit: string | null;
  readonly grism: string | null;
  readonly filter: string | null;
  /** The position angle the telescope was asked for, and the rotator angle at the start and end of the first exposure. */
  readonly positionAngleDeg: number | null;
  readonly rotatorStartDeg: number | null;
  readonly rotatorEndDeg: number | null;
  /** Every exposure's midpoint in UTC, from its own start and integration time, in time order. */
  readonly exposureMidpointsUtc: readonly string[];
  /** The pointing of the first exposure, as the telescope recorded it. */
  readonly raDeg: number | null;
  readonly decDeg: number | null;
  readonly airmass: number | null;
}

const number = (header: EsoHeader, key: string) => { const value = header[key]; return typeof value === 'number' ? value : null; };
const text = (header: EsoHeader, key: string) => { const value = header[key]; return typeof value === 'string' ? value.trim() : null; };

/** The midpoint of an exposure, from its start and its total integration time. */
export function midpointUtc(start: string, seconds: number) {
  const began = Date.parse(start.endsWith('Z') ? start : `${start}Z`);
  if (!Number.isFinite(began)) throw new Error(`${start} is not a time.`);
  return new Date(began + (seconds * 1000) / 2).toISOString();
}

/** What the headers say about where the slit was and how the sky maps onto the detector. */
export function slitGeometry(headers: readonly { readonly start: string; readonly exposure: number; readonly header: EsoHeader }[]): SlitGeometry {
  const first = headers[0];
  if (!first) throw new Error('No frames to read a geometry from.');
  const { header } = first;
  return {
    pixelScaleArcsec: number(header, 'ESO INS PIXSCALE'),
    objective: text(header, 'ESO INS OPTI7 ID'),
    slit: text(header, 'ESO INS OPTI1 ID'),
    grism: text(header, 'ESO INS OPTI4 ID'),
    filter: text(header, 'ESO INS OPTI6 ID'),
    positionAngleDeg: number(header, 'ESO ADA POSANG'),
    rotatorStartDeg: number(header, 'ESO ADA ABSROT START'),
    rotatorEndDeg: number(header, 'ESO ADA ABSROT END'),
    exposureMidpointsUtc: headers.map(entry => midpointUtc(entry.start, entry.exposure)),
    raDeg: number(header, 'RA'),
    decDeg: number(header, 'DEC'),
    airmass: number(header, 'AIRMASS'),
  };
}

export interface Resolution {
  /** The target's and the standard's full width at half maximum across the slit, in pixels and arcseconds. */
  readonly targetFwhmPixels: number;
  readonly targetFwhmArcsec: number | null;
  readonly standardFwhmPixels: number | null;
  readonly standardFwhmArcsec: number | null;
  /** The ratio of the two widths, and the verdict it supports. */
  readonly ratio: number | null;
  readonly resolvedAlongSlit: boolean | null;
  readonly note: string;
}

/** Whether the target's profile across the slit is wider than the point source's. A ratio is only a verdict when a standard
 * was taken; without one nothing is claimed. The threshold is deliberately plain: a disc that is resolved is wider than the
 * instrument's own profile, so a ratio at or below one is not resolved, whatever an ephemeris would predict. */
export function resolutionOf(target: TraceMeasurement, standard: TraceMeasurement | null): Resolution {
  const ratio = standard ? target.fwhmPixels / standard.fwhmPixels : null;
  return {
    targetFwhmPixels: target.fwhmPixels, targetFwhmArcsec: target.fwhmArcsec,
    standardFwhmPixels: standard?.fwhmPixels ?? null, standardFwhmArcsec: standard?.fwhmArcsec ?? null,
    ratio, resolvedAlongSlit: ratio === null ? null : ratio > 1,
    note: standard
      ? 'Measured against the telluric standard taken through the same slit and grism on the same night. A ratio above one is'
        + ' a target wider than the instrument profile, which is what resolved along the slit means here.'
      : 'The night pins no telluric standard, so nothing is claimed about whether the target is resolved.',
  };
}

export interface SpectrumReproduction {
  readonly schema: 'cssearth-naco-spectrum@1';
  readonly program: string;
  readonly object: string;
  readonly night: string;
  readonly kind: 'two-nod-halves';
  readonly note: string;
  readonly oracle: string;
  readonly halves: readonly { readonly half: string; readonly path: string; readonly sha256: string; readonly bytes: number; readonly frames: number }[];
  /** Which detector axis the slit runs along, and the contiguous trace runs that decided it. */
  readonly slitAxis: { readonly axis: 'x' | 'y'; readonly runAlongX: number; readonly runAlongY: number };
  readonly geometry: SlitGeometry;
  readonly resolution: Resolution;
  /** The two halves' extracted one-dimensional spectra, compared sample by sample. */
  readonly spectrum: Statistics;
  readonly arcs: boolean;
}

const NOTE = 'Internal and physical checks only. The ESO archive publishes no Phase 3 product and no master calibration for'
  + ' NACO, and ESO\'s telescope bibliography records no publication for this run, so there is nothing external to check it'
  + ' against. The two halves share no exposure and measure repeatability, not accuracy.';

export async function writeSpectrumReceipt(programId: string, work: string): Promise<SpectrumReproduction> {
  const program = await readProgram(programId);
  if (program.mode !== 'spectroscopy') throw new Error(`${programId} is an ${program.mode} program.`);
  const load = async (half: string): Promise<ReductionResult> => {
    const name = `reduced-${half}.json`;
    return readReduction(JSON.parse(await readFile(resolve(work, name), 'utf8')) as unknown, name);
  };
  const all = await load('all'), first = await load('a-half'), second = await load('b-half');

  const axis = await detectSlitAxis(all.combined);
  const headers = resolve(work, 'headers');
  const frameHeaders = await Promise.all(program.science.map(async frame =>
    ({ start: frame.start, exposure: frame.exposure, header: await archiveHeader(frame.dpId, headers) })));
  const geometry = slitGeometry(frameHeaders);

  const target = await measureTrace(all.combined, geometry.pixelScaleArcsec, axis.axis);
  const standard = all.standardCombined ? await measureTrace(all.standardCombined, geometry.pixelScaleArcsec, axis.axis) : null;

  // The two halves' one-dimensional spectra, extracted on the same band around the same trace so the comparison is of flux
  // and not of where each half happened to put its trace.
  const spectrumOf = async (result: ReductionResult) => {
    const { frame } = await readFrame(result.combined);
    return extractSpectrum(frame, axis.axis, target.centroid, EXTRACTION_HALF_WIDTH);
  };
  const a = await spectrumOf(first), b = await spectrumOf(second);
  if (a.length !== b.length) throw new Error(`The two halves extracted ${a.length} and ${b.length} samples.`);
  const spectrum = await statistics(visit => { for (let index = 0; index < a.length; index++) visit(a[index]!, b[index]!); }, a.length);

  const halves = await Promise.all(([['a-half', first], ['b-half', second]] as const).map(async ([half, result]) => {
    const digest = await sha256File(result.combined);
    return { half, path: repositoryPath(result.combined), sha256: digest.sha256, bytes: digest.bytes, frames: result.objectFrames };
  }));

  const value: SpectrumReproduction = {
    schema: 'cssearth-naco-spectrum@1', program: program.program, object: program.object, night: program.night,
    kind: 'two-nod-halves', note: NOTE,
    oracle: 'No published or archive product. ESO telbib lists two papers for programme 088.C-0833 and both are the SINFONI'
      + ' run 088.C-0833(A); it lists none for the NACO run 088.C-0833(B).',
    halves, slitAxis: { axis: axis.axis, runAlongX: axis.runAlongX, runAlongY: axis.runAlongY },
    geometry, resolution: resolutionOf(target, standard), spectrum, arcs: program.arcs,
  };
  await writeFile(resolve(PROGRAMS, `${program.program}.spectrum.reproduction.json`), `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

const REPOSITORY = resolve(import.meta.dirname, '../../..');
const repositoryPath = (path: string) => path.startsWith(`${REPOSITORY}/`) ? path.slice(REPOSITORY.length + 1) : path;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, work] = process.argv.slice(2);
  if (!id || !work) throw new TypeError('Usage: spectroscopy-receipt <program id> <work directory>');
  const value = await writeSpectrumReceipt(id, resolve(work));
  const { resolution: verdict, spectrum } = value;
  console.log(`${value.program}: trace ${verdict.targetFwhmPixels.toFixed(2)} px against the standard's`
    + ` ${verdict.standardFwhmPixels?.toFixed(2) ?? 'n/a'} px (ratio ${verdict.ratio?.toFixed(2) ?? 'n/a'}),`
    + ` resolved along the slit: ${String(verdict.resolvedAlongSlit)}; halves correlate ${spectrum.aboveMedian.correlation?.toFixed(4) ?? 'n/a'}.`);
}

export { type NacoProgram };
