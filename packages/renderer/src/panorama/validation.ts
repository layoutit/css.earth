import { validatePreparedCssSky } from '../sky/validation.js';
import type { PreparedSurfacePanoramas } from './types.js';

const record = (value: unknown, keys: readonly string[], name: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || keys.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !keys.includes(key))) {
    throw new TypeError(`Prepared ${name} has unsupported or missing fields.`);
  }
  return value as Record<string, unknown>;
};
const text = (value: unknown, name: string): string => { if (typeof value !== 'string' || !value) throw new TypeError(`Prepared ${name} must be text.`); return value; };
const finite = (value: unknown, name: string): number => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Prepared ${name} must be a finite number.`); return value; };
const sceneUrl = (value: unknown, name: string): string => {
  const url = text(value, name);
  if (!/^\/scenes\/[a-z][a-z0-9-]*\/[a-z0-9][a-z0-9@._-]*\.webp$/u.test(url)) throw new TypeError(`Prepared ${name} ${url} must be a /scenes/ WebP address.`);
  return url;
};

/** Validate a prepared surface panorama plan before anything is mounted from it. */
export function requireSurfacePanoramas(value: unknown): PreparedSurfacePanoramas {
  const plan = record(value, ['schema', 'source', 'frame', 'panoramas'], 'surface panoramas');
  if (plan.schema !== 'cssearth-surface-panorama-plan@1') throw new TypeError('Prepared surface panorama schema is incompatible.');
  const source = record(plan.source, ['label', 'url'], 'surface panorama source'); text(source.label, 'panorama source label');
  if (!/^https:\/\//u.test(text(source.url, 'panorama source URL'))) throw new TypeError('Prepared panorama source must link over https.');
  const frame = text(plan.frame, 'panorama frame');
  if (!Array.isArray(plan.panoramas) || !plan.panoramas.length) throw new TypeError('Prepared surface panoramas must list at least one panorama.');
  const ids = new Set<string>();
  for (const item of plan.panoramas) {
    const entry = record(item, ['id', 'title', 'sols', 'camera', 'credit', 'pageUrl', 'site', 'spanDeg', 'thumbnail', 'faces', 'sky', 'resources'], 'surface panorama');
    const id = text(entry.id, 'panorama id');
    if (!/^[a-z][a-z0-9-]*$/u.test(id) || ids.has(id)) throw new TypeError(`Prepared panorama id ${id} must be unique and kebab-case.`);
    ids.add(id);
    text(entry.title, 'panorama title'); text(entry.camera, 'panorama camera'); text(entry.credit, 'panorama credit');
    if (!/^https:\/\//u.test(text(entry.pageUrl, 'panorama page'))) throw new TypeError(`Prepared panorama ${id} must link its page over https.`);
    if (!Array.isArray(entry.sols) || entry.sols.length !== 2 || !entry.sols.every(sol => Number.isInteger(sol) && sol >= 0) || entry.sols[0] > entry.sols[1]) throw new TypeError(`Prepared panorama ${id} sols are invalid.`);
    const site = record(entry.site, ['latitudeDeg', 'longitudeDegEast', 'localization'], 'panorama site');
    if (Math.abs(finite(site.latitudeDeg, 'panorama latitude')) > 90) throw new TypeError(`Prepared panorama ${id} latitude is out of range.`);
    const longitude = finite(site.longitudeDegEast, 'panorama longitude'); if (longitude < 0 || longitude >= 360) throw new TypeError(`Prepared panorama ${id} longitude is out of range.`);
    text(site.localization, 'panorama localisation');
    if (finite(entry.spanDeg, 'panorama span') <= 0) throw new TypeError(`Prepared panorama ${id} span must be positive.`);
    sceneUrl(entry.thumbnail, 'panorama thumbnail');
    if (!Array.isArray(entry.faces) || entry.faces.length !== 6) throw new TypeError(`Prepared panorama ${id} needs six face addresses.`);
    const faces = entry.faces.map(face => sceneUrl(face, 'panorama face'));
    if (!Array.isArray(entry.resources)) throw new TypeError(`Prepared panorama ${id} resources are missing.`);
    const sky = validatePreparedCssSky(entry.sky, entry.resources as never);
    if (sky.referenceFrame !== frame) throw new TypeError(`Prepared panorama ${id} is not in the plan's frame.`);
    if (sky.faces.some((face, index) => !faces[index]!.endsWith(`/${face.texturePath}`))) throw new TypeError(`Prepared panorama ${id} face addresses must name its cube faces in order.`);
  }
  return value as PreparedSurfacePanoramas;
}
