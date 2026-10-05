/** Requests taken from static page outputs, native forms and the three deployed handler protocols. */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { CAMERA_POSE_SCHEMA } from '@cssearth/objects';
import { formatSharedView } from '@cssearth/renderer/navigation';
import { object, type AnswerRequest, type Target } from './model.mts';
// Registry capability cover: systems, clusters, galaxy, universe, terrestrial and gas surfaces, and named features.
export const representatives = ['earth-system', 'lmc', 'neptune-system', 'beta-pictoris-system', 'asteroid-2001-sn263-system', 'mars-system', 'observable-universe', 'abell-1689', 'centaurus-cluster', 'dione', 'great-attractor', 'local-group', 'milky-way', 'earth', 'saturn'];
export async function catalogue(dist: string): Promise<AnswerRequest[]> {
  const index = object(JSON.parse(await readFile(resolve(dist, 'catalogue/index.json'), 'utf8')));
  if (!Array.isArray(index.entries)) throw new Error('Built registry entries missing');
  const entries = index.entries.map(object);
  const requests: AnswerRequest[] = [];
  for (const id of representatives) {
    const entry = entries.find(entry => entry.id === id);
    if (!entry || typeof entry.name !== 'string') throw new Error(`Representative absent from built registry: ${id}`);
    const html = await readFile(resolve(dist, id, 'index.html'), 'utf8');
    const document = parseHTML(html).document;
    const datasets = [...document.querySelectorAll('button[name=dataset]')].map(button => button.getAttribute('value')).filter(value => value !== null);
    const sceneId = document.querySelector('[data-object-id]')?.getAttribute('data-object-id');
    if (!sceneId) throw new Error(`No scene id for ${id}`);
    const descriptorText = document.querySelector('[data-prepared-descriptor]')?.textContent;
    if (!descriptorText) throw new Error(`Missing prepared descriptor ${id}`);
    const descriptor = object(JSON.parse(descriptorText)), properties = object(descriptor.properties), frame = object(properties.worldFrame);
    if (typeof frame.epochJdTt !== 'number' || typeof frame.bodyRadiusM !== 'number') throw new Error(`Invalid world frame ${id}`);
    const shared = formatSharedView({ camera: { distanceKilometers: frame.bodyRadiusM * 8 / 1000, pose: { schema: CAMERA_POSE_SCHEMA, scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } }, playback: { times: [], speed: 1, motionRequested: false }, preparedEpochJdTt: frame.epochJdTt });
    const queries: Record<string, string> = { plain: '', 'shared-valid': shared, 'view-body': 'view=body', view: 'view=system', category: 'q=planets', browse: 'browse=planets', 'category-context': 'q=planets&category=planet&view=system', search: 'q=europa', empty: 'q=', settings: 'settings=1&shadows=on&speed=0', shared: 'v=damaged', combined: 'q=europa&v=damaged&view=system' };
    datasets.forEach((dataset, n) => { queries[`dataset-${n}`] = `dataset=${encodeURIComponent(dataset)}`; });
    for (const [shape, query] of Object.entries(queries)) requests.push({ id: `${id}-${shape}`, path: `/${id}/${query ? '?' + query : ''}`, expected: 200, html: true, title: entry.name });
    const scene = document.querySelector('[data-object-id]')?.getAttribute('data-object-id');
    if (!scene) throw new Error(`No scene id for ${id}`);
    requests.push({ id: `${id}-navigation`, path: `/navigation/${scene}/`, expected: 200 });
    requests.push({ id: `${id}-first-view`, path: `/objects/${scene}/first-view.json`, expected: 200 });
  }
  for (const [shape, query] of Object.entries({ missing: '', valid: 'object=earth&q=europa', empty: 'object=earth&q=', invalid: 'object=../earth&q=x', offset: 'object=earth&q=europa&offset=-1', huge: 'object=earth&q=' + 'x'.repeat(5000), place: 'object=earth&place=invalid', both: 'object=earth&q=x&place=1' })) requests.push({ id: `find-${shape}`, path: '/.netlify/functions/find' + (query ? '?' + query : ''), expected: ['missing', 'invalid', 'offset', 'place', 'both'].includes(shape) ? 400 : 200 });
  for (const [shape, query] of Object.entries({ 'place-numeric': 'object=earth&place=3435910', 'offset-positive': 'object=earth&q=planets&offset=2', illustrations: 'object=earth&q=comets&illustrations=1', 'second-features': 'object=dione&q=Palatine' })) requests.push({ id: `find-${shape}`, path: '/.netlify/functions/find?' + query, expected: shape === 'place-numeric' ? 404 : 200 });
  for (const name of ['find', 'search', 'report']) {
    const query = name === 'find' ? '?object=earth&q=europa' : name === 'search' ? '?object=earth&q=europa' : '';
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'POST']) requests.push({ id: `${name}-${method.toLowerCase()}`, path: `/.netlify/functions/${name}${query}`, method, ...(method === 'POST' ? { body: 'offline safety probe' } : {}), expected: name === 'report' ? method === 'POST' ? 204 : 405 : ['GET', 'HEAD'].includes(method) ? 200 : 405 });
  }
  for (const [shape, query] of Object.entries({ missing: '', empty: '?object=', invalid: '?object=../earth', dataset: '?object=saturn&dataset=ultraviolet', settings: '?object=earth&settings=1&shadows=on', feature: '?object=earth&feature=1159321043', shared: '?object=saturn&v=damaged', huge: '?object=earth&q=' + 'x'.repeat(5000) })) requests.push({ id: `search-${shape}`, path: '/.netlify/functions/search' + query, expected: ['missing', 'empty', 'invalid'].includes(shape) ? 404 : 200 });
  for (const [shape, query] of Object.entries({ 'bad-feature': 'object=earth&feature=bad', 'unknown-feature': 'object=earth&feature=9999999999999999', 'missing-dataset': 'object=earth&dataset=unavailable', 'bad-settings': 'object=earth&settings=bad', 'duplicate-view': 'object=earth&v=a&v=b', 'unknown-object': 'object=no-such-object' })) requests.push({ id: `search-${shape}`, path: '/.netlify/functions/search?' + query, expected: shape === 'unknown-object' ? 404 : 400 });
  for (const method of ['HEAD', 'POST']) requests.push({ id: `earth-query-${method.toLowerCase()}`, path: '/earth/?q=europa', method, ...(method === 'POST' ? { body: 'offline safety probe' } : {}), expected: method === 'HEAD' ? 200 : 405 });
  requests.push({ id: 'earth-no-slash-query', path: '/earth?q=europa', expected: 200, html: true, title: 'Earth' }, { id: 'page-origin', path: '/earth/?q=europa', headers: { Origin: 'https://reader.invalid' }, expected: 200, html: true, title: 'Earth' }, { id: 'cloudflare-www', path: 'https://www.answers.invalid/earth/?q=europa', expected: 301 });
  for (const shape of ['empty', 'huge']) requests.push({ id: `report-${shape}`, path: '/.netlify/functions/report', method: 'POST', body: shape === 'empty' ? '' : 'x'.repeat(6000), expected: 204 });
  requests.push({ id: 'earth-feature', path: '/earth/?feature=1159321043', expected: 200, html: true, title: 'Earth' }, { id: 'root-search', path: '/?q=europa', expected: 200, html: true, title: 'Earth' });
  const assets = (await readdir(resolve(dist, '_astro'))).filter(name => /^ObjectLayout\.astro_astro_type_script_index_0_lang\.[^.]+\.js$/u.test(name));
  if (assets.length !== 1) throw new Error('Expected exactly one named ObjectLayout script');
  const asset = assets[0];
  if (!asset) throw new Error('No static script for range probes');
  for (const [id, headers, conditional] of [ ['range', { Range: 'bytes=0-63' }, undefined], ['range-invalid', { Range: 'bytes=999999999999-' }, undefined], ['etag', {}, 'etag'], ['modified', {}, 'modified'] ] satisfies [string, Record<string, string>, AnswerRequest['conditional']][]) requests.push({ id: `static-${id}`, path: `/_astro/${asset}`, headers, conditional });
  for (const [id, path] of [['robots', '/robots.txt'], ['sitemap', '/sitemap.xml'], ['missing-page', '/no-such-object/'], ['missing-file', '/no-such-file.bin'], ['prepared', '/src/objects/earth/prepared/runtime.json'], ['prepared-range', '/src/objects/earth/prepared/runtime.json']]) requests.push({ id, path, ...(id === 'prepared-range' ? { headers: { Range: 'bytes=0-63' } } : {}) });
  return requests;
}

/** Keep page addresses intact: each deployment's real router decides whether the handler or static layer answers. */
export function requestsForTarget(all: AnswerRequest[], target: Target): AnswerRequest[] {
  return all.filter(request => request.id === 'cloudflare-www' ? target === 'cloudflare' : request.id.startsWith('prepared') ? target === 'preview' : target === 'cloudflare' ? !request.id.startsWith('static-') : true);
}
