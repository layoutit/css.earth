#!/usr/bin/env node
/** The imaging the ALMA pipeline performed, read from the command log it ships.
 *
 * Every delivery carries `<member>.<recipe>.casa_commands.log`: the CASA calls the pipeline actually made, tclean included.
 * Reading the call it ran on a field is better than choosing settings that look reasonable, for the same reason the calibration
 * is replayed rather than re-derived — the archive's image is the thing being reproduced, so its own arguments are the ones to
 * use, and any difference in the result is then the route's rather than a different choice of deconvolver.
 *
 * It also settles a conversion this route would otherwise have to make. `cont.dat` states the line-free ranges in LSRK; the
 * selection tclean takes is in the measurement set's own frame, and the pipeline has already converted it. Taking the log's
 * selection avoids converting it again, differently. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FitsHeader } from '@cssearth/fits';

export interface PipelineImaging {
  readonly field: string;
  readonly imageName: string;
  /** The spectral-window selection in the measurement set's frame, as tclean received it. */
  readonly spw: string;
  readonly cell: string;
  readonly imageSize: readonly [number, number];
  readonly deconvolver: string;
  readonly terms: number;
  readonly weighting: string;
  readonly robust: number;
  readonly threshold: string;
  readonly phaseCentre: string | null;
  readonly scan: string | null;
  readonly intent: string | null;
  /** Every argument as written, as Python literals. The restore passes these to tclean, not the fields above. */
  readonly arguments: ReadonlyMap<string, string>;
}

/** tclean calls in a command log, each gathered from its opening to its closing parenthesis. */
export function tcleanCalls(log: string) {
  const calls: string[] = [];
  for (let index = log.indexOf('tclean('); index >= 0; index = log.indexOf('tclean(', index + 1)) {
    if (index > 0 && /[\w.]/u.test(log[index - 1]!)) continue;
    let depth = 0, quote = '';
    for (let cursor = index + 'tclean'.length; cursor < log.length; cursor++) {
      const character = log[cursor]!;
      if (quote) { if (character === quote) quote = ''; continue; }
      if (character === "'" || character === '"') quote = character;
      else if (character === '(') depth += 1;
      else if (character === ')') { depth -= 1; if (depth === 0) { calls.push(log.slice(index, cursor + 1)); break; } }
    }
  }
  return calls;
}

const argument = (call: string, name: string) => {
  // Values are Python literals: a quoted string, a number, or a list of either. Newlines and indentation are the log's wrapping.
  const match = new RegExp(`\\b${name}=(\\[[^\\]]*\\]|'(?:[^']|\\n)*'|"[^"]*"|[\\w.+-]+)`, 'u').exec(call);
  return match ? match[1]!.replace(/\s*\n\s+/gu, ' ').trim() : null;
};
/** The first literal of a tclean argument. A list holds one string per measurement set, and that string may itself contain
 * commas — `scan=['9,11,13']` is one selection, not three — so the quotes bound it, never the commas. */
const unquote = (value: string) => {
  const trimmed = value.trim();
  const inner = trimmed.startsWith('[') ? trimmed.slice(1, -1).trim() : trimmed;
  const quoted = /^(['"])([\s\S]*?)\1/u.exec(inner);
  return quoted ? quoted[2]! : inner.split(',')[0]!.trim();
};
const asNumber = (value: string | null, fallback: number) => {
  const parsed = Number(value?.replace(/^\[|\]$/gu, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** The continuum imaging the pipeline ran for one field: its last call, which is the one it delivered. */
export function pipelineImaging(log: string, field: string): PipelineImaging {
  const wanted = tcleanCalls(log).filter(call => argument(call, 'field') !== null && unquote(argument(call, 'field')!) === field);
  const continuum = wanted.filter(call => (argument(call, 'imagename') ?? '').includes('cont'));
  const chosen = continuum.at(-1) ?? wanted.at(-1);
  if (!chosen) throw new TypeError(`The command log records no tclean for ${field}.`);
  const values = new Map<string, string>();
  for (const match of chosen.matchAll(/\b(\w+)=(\[[^\]]*\]|'(?:[^']|\n)*'|"[^"]*"|[\w.+-]+)/gu)) {
    values.set(match[1]!, match[2]!.replace(/\s*\n\s+/gu, ' ').trim());
  }
  const size = argument(chosen, 'imsize');
  const sizes = (size ?? '').replace(/^\[|\]$/gu, '').split(',').map(part => Number(part.trim()));
  const spw = argument(chosen, 'spw');
  if (!spw) throw new TypeError(`The tclean for ${field} states no spectral-window selection.`);
  const optional = (name: string) => { const value = argument(chosen, name); return value === null ? null : unquote(value); };
  return {
    field, imageName: unquote(argument(chosen, 'imagename') ?? "''"), spw: unquote(spw),
    cell: unquote(argument(chosen, 'cell') ?? "'0.0055arcsec'"),
    imageSize: [sizes[0] && Number.isFinite(sizes[0]) ? sizes[0] : 3200, sizes[1] && Number.isFinite(sizes[1]) ? sizes[1] : 3200],
    deconvolver: unquote(argument(chosen, 'deconvolver') ?? "'hogbom'"), terms: asNumber(argument(chosen, 'nterms'), 1),
    weighting: unquote(argument(chosen, 'weighting') ?? "'briggs'"), robust: asNumber(argument(chosen, 'robust'), 0.5),
    threshold: unquote(argument(chosen, 'threshold') ?? "'0mJy'"),
    phaseCentre: optional('phasecenter'), scan: optional('scan'), intent: optional('intent'),
    arguments: values,
  };
}

/** The pipeline's phase centre at full precision. The command log prints it shortened (to 0.1 ms in right ascension and 1 mas
 * in declination), and a grid moved by that shortening shows up as a dipole across the star when the two images are differenced:
 * 0.25 and 0.54 mas on R Doradus. The pipeline's image records the same centre as its reference pixel, unrounded. It is taken
 * from there only when the image is centred on its reference pixel and agrees with the logged centre to within one unit
 * of its last printed digit; anything else is a different centre and stops the run. */
export function precisePhaseCentre(logged: string, header: FitsHeader, imageSize: readonly [number, number]) {
  const match = /^(\w+)\s+(\d+):(\d+):(\d+(?:\.(\d+))?)\s+([+-]?)(\d+)\.(\d+)\.(\d+(?:\.(\d+))?)$/u.exec(logged.trim());
  if (!match) throw new TypeError(`The logged phase centre ${logged} is not in the sexagesimal form this route reads.`);
  const [, frame, hours, minutes, seconds, secondDigits = '', sign, degrees, arcminutes, arcseconds, arcsecondDigits = ''] = match;
  const loggedRa = 15 * (Number(hours) + Number(minutes) / 60 + Number(seconds) / 3600);
  const loggedDec = (sign === '-' ? -1 : 1) * (Number(degrees) + Number(arcminutes) / 60 + Number(arcseconds) / 3600);
  const text = (key: string) => String(header[key] ?? '').trim();
  const number = (key: string) => { const value = header[key]; if (typeof value !== 'number') throw new TypeError(`The archive image has no numeric ${key}.`); return value; };
  if (text('RADESYS') !== frame) throw new TypeError(`The archive image is in ${text('RADESYS') || 'no frame'}, the logged centre in ${frame}.`);
  if (!text('CTYPE1').startsWith('RA---') || !text('CTYPE2').startsWith('DEC--')) throw new TypeError('The archive image\u2019s first two axes are not right ascension and declination.');
  if (number('CRPIX1') !== imageSize[0] / 2 + 1 || number('CRPIX2') !== imageSize[1] / 2 + 1) throw new TypeError('The archive image\u2019s reference pixel is not its centre, so it does not record the phase centre.');
  const ra = number('CRVAL1'), dec = number('CRVAL2');
  const cosine = Math.cos(dec * Math.PI / 180);
  const offsetRaMas = Math.abs(ra - loggedRa) * cosine * 3.6e6, offsetDecMas = Math.abs(dec - loggedDec) * 3.6e6;
  // One unit of the last printed digit: the log rounds right ascension (45.35716506 s became 45.3572) but truncates
  // declination (39.61953556 arcsec became 39.619).
  const toleranceRaMas = 10 ** -secondDigits.length * 15 * cosine * 1000, toleranceDecMas = 10 ** -arcsecondDigits.length * 1000;
  if (offsetRaMas > toleranceRaMas * 1.01 || offsetDecMas > toleranceDecMas * 1.01) {
    throw new TypeError(`The archive image is centred ${offsetRaMas.toFixed(2)} mas in RA and ${offsetDecMas.toFixed(2)} mas in Dec from the logged centre, more than the log's last digit.`);
  }
  return { phaseCentre: `${frame} ${ra.toFixed(11)}deg ${dec.toFixed(11)}deg`, offsetRaMas, offsetDecMas };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [path, field] = process.argv.slice(2);
  if (!path || !field) throw new TypeError('Usage: alma-imaging.mts <casa_commands.log> <field>');
  const imaging = pipelineImaging(await readFile(path, 'utf8'), field);
  console.log(`${imaging.field}: ${imaging.deconvolver}${imaging.terms > 1 ? ` with ${imaging.terms} terms` : ''}, ` +
    `${imaging.imageSize[0]}x${imaging.imageSize[1]} of ${imaging.cell}, ${imaging.weighting} robust ${imaging.robust}, threshold ${imaging.threshold}`);
  console.log(`  scans ${imaging.scan ?? 'all'}, intent ${imaging.intent ?? 'any'}`);
  console.log(`  spw ${imaging.spw.slice(0, 120)}...`);
}
