#!/usr/bin/env node
/**
 * Fetch the measurements `author.mts` paints asteroids with, into `inputs.json`.
 *
 *   node packages/bake/authoring/asteroid-colors/fetch.mts [<id>:<number>:<name> ...]
 *
 * Arguments add bodies to the table. Every body in the table then gets its Gaia DR3 mean reflectance spectrum (one query
 * of `gaiadr3.sso_reflectance_spectrum` for all of them) and the geometric albedo the JPL Small-Body Database lists, with
 * JPL's stated reference. A body Gaia did not publish, or JPL lists without an albedo, stops the run.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

const path = resolve(import.meta.dirname, 'inputs.json');
const inputs = requireRecord(JSON.parse(await readFile(path, 'utf8')));
const bodies = requireArray(inputs.bodies).map(value => requireRecord(value));
for (const argument of process.argv.slice(2)) {
  const [id, number, ...name] = argument.split(':');
  if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || !/^\d+$/u.test(number ?? '') || !name.length) throw new TypeError(`Expected <id>:<number>:<name>, got ${argument}.`);
  if (!bodies.some(body => body.id === id)) bodies.push({ id, number: Number(number), name: name.join(':') });
}
const numbers = bodies.map(body => requireFiniteNumber(body.number));

const query = `SELECT number_mp, num_of_spectra, wavelength, reflectance_spectrum, reflectance_spectrum_err, reflectance_spectrum_flag FROM gaiadr3.sso_reflectance_spectrum WHERE number_mp IN (${numbers.join(',')}) ORDER BY number_mp, wavelength`;
const response = await fetch(requireString(requireRecord(inputs.spectra).tap), { method: 'POST',
  body: new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: query }) });
if (!response.ok) throw new Error(`Gaia archive: HTTP ${response.status}`);
const [header, ...lines] = (await response.text()).trim().split(/\r?\n/u);
if (header !== 'number_mp,num_of_spectra,wavelength,reflectance_spectrum,reflectance_spectrum_err,reflectance_spectrum_flag') throw new Error(`Unexpected Gaia columns: ${header}`);
const spectra = new Map<number, { epochs: number; samples: number[][] }>();
for (const line of lines) {
  const [number, epochs, wavelength, value, uncertainty, flag] = line.split(',').map(Number);
  const spectrum = spectra.get(number!) ?? { epochs: epochs!, samples: [] };
  spectrum.samples.push([wavelength!, value!, uncertainty!, flag!]);
  spectra.set(number!, spectrum);
}

async function albedo(number: number) {
  const record = requireRecord(await (await fetch(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${number}&phys-par=1`)).json());
  const entry = requireArray(record.phys_par).map(value => requireRecord(value)).find(parameter => parameter.name === 'albedo');
  if (!entry) throw new Error(`JPL lists no albedo for ${number}.`);
  return { value: Number(requireString(entry.value)), uncertainty: entry.sigma === null ? null : Number(requireString(entry.sigma)), reference: requireString(entry.ref) };
}

for (const body of bodies) {
  const number = requireFiniteNumber(body.number), spectrum = spectra.get(number);
  if (!spectrum || spectrum.samples.length !== 16) throw new Error(`Gaia DR3 has no 16-band reflectance spectrum for ${number}.`);
  body.epochs = spectrum.epochs;
  body.samples = spectrum.samples;
  body.albedo = await albedo(number);
}
inputs.checked = new Date().toISOString().slice(0, 10);
inputs.bodies = bodies.sort((a, b) => requireFiniteNumber(a.number) - requireFiniteNumber(b.number));
// One body per line keeps the table readable and its diffs small.
const rows = bodies.map(body => `    ${JSON.stringify(body)}`).join(',\n');
await writeFile(path, `${JSON.stringify({ ...inputs, bodies: [] }, null, 2).replace(/"bodies": \[\]/u, `"bodies": [\n${rows}\n  ]`)}\n`);
console.log(`${bodies.length} bodies fetched.`);
