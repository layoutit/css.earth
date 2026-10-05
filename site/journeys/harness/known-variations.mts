/** Bounded application-owned variation. Every declaration names exactly one canonical measure. */
import { json, type Json, type Trace } from './trace.mts';
export interface Variation { id: string; step: string; measure: string; allowed: Json[]; reason: string }
function exact(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(exact).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + exact(value[key]!)).join(',') + '}';
  return JSON.stringify(value);
}
export function parseVariations(input: unknown): Variation[] {
  if (!Array.isArray(input)) throw new Error('Expected known variations');
  const rows = input.map((row: unknown): Variation => {
    if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(row.id)
      || !('step' in row) || typeof row.step !== 'string' || !row.step || !('measure' in row) || typeof row.measure !== 'string'
      || !('allowed' in row) || !Array.isArray(row.allowed) || row.allowed.length < 2 || row.allowed.length > 16
      || !('reason' in row) || typeof row.reason !== 'string' || !row.reason.trim()
      || Object.keys(row).some(key => !['id', 'step', 'measure', 'allowed', 'reason'].includes(key))) throw new Error('Invalid known variation');
    const measure: unknown = JSON.parse(row.measure);
    if (!Array.isArray(measure) || measure.length !== 3 || !['network', 'dom', 'content', 'rendering'].includes(measure[0])
      || !measure.every(item => typeof item === 'string' && item.length > 0) || measure.some(item => /[*]/u.test(item))
      || !/^[a-zA-Z][a-zA-Z0-9]*$/u.test(measure[2])) throw new Error('Variation must name one exact measure');
    const allowed = row.allowed.map(value => json(value));
    if (new Set(allowed.map(exact)).size !== allowed.length) throw new Error('Duplicate variation values');
    return { id: row.id, step: row.step, measure: row.measure, allowed, reason: row.reason };
  });
  if (new Set(rows.map(row => JSON.stringify([row.id, row.step, row.measure]))).size !== rows.length) throw new Error('Duplicate known measure');
  return rows;
}
export const knownVariations: Variation[] = parseVariations([
{
  "id": "earth-system-deep-link",
  "step": "deep-link",
  "measure": "[\"network\",\"/scenes/earth/earth-surface-page-16-level-400.webp\",\"count\"]",
  "allowed": [
    1,
    2
  ],
  "reason": "The same locked Earth settings captures show this exact successful texture request once or twice; only its count varies, with all other network fields and endpoint pixels exact."
},
{
  "id": "earth-system-deep-link",
  "step": "deep-link",
  "measure": "[\"network\",\"/scenes/earth/earth-surface-page-17-level-400.webp\",\"count\"]",
  "allowed": [
    1,
    2
  ],
  "reason": "The same locked Earth settings captures show this exact successful texture request once or twice; only its count varies, with all other network fields and endpoint pixels exact."
},
{
  "id": "earth-system-deep-link",
  "step": "deep-link",
  "measure": "[\"network\",\"/scenes/earth/earth-surface-page-18-level-400.webp\",\"count\"]",
  "allowed": [
    1,
    2
  ],
  "reason": "The same locked Earth settings captures show this exact successful texture request once or twice; only its count varies, with all other network fields and endpoint pixels exact."
},
{
  "id": "earth-system-deep-link",
  "step": "deep-link",
  "measure": "[\"network\",\"/scenes/earth/earth-surface-page-19-level-400.webp\",\"count\"]",
  "allowed": [
    1,
    2
  ],
  "reason": "The same locked Earth settings captures show this exact successful texture request once or twice; only its count varies, with all other network fields and endpoint pixels exact."
},
  {
    "id": "earth-system-deep-link",
    "step": "deep-link",
    "measure": "[\"network\",\"/scenes/earth/earth-surface-page-11-level-480.webp\",\"count\"]",
    "allowed": [
      1,
      2
    ],
    "reason": "Application texture consumers race: locked batch four requests the identical successful WebP once or twice; status, cache, initiator, resource type and pixels remain exact."
  },
  {
    "id": "beta-pictoris-system",
    "step": "select-host",
    "measure": "[\"dom\",\"document>html.[[\\\"data-scene-presented\\\",\\\"true\\\"]]@0>body.[[\\\"data-object-shell\\\",\\\"beta-pictoris\\\"]]@0>div.object-viewport[]@0>div.object-world-stage[]@0>div.prepared-world-context[[\\\"data-world-context\\\",\\\"sun\\\"]]@0>b.context-mover[]@18>s.[[\\\"data-context-annotations-animate\\\",\\\"false\\\"],[\\\"data-context-body\\\",\\\"wasp-62\\\"],[\\\"data-context-body-visible\\\",\\\"true\\\"],[\\\"data-context-group\\\",\\\"wasp-62\\\"],[\\\"data-context-indicator-visible\\\",\\\"false\\\"],[\\\"data-context-label\\\",\\\"wasp-62\\\"],[\\\"data-context-label-case\\\",\\\"upper\\\"],[\\\"data-context-label-visible\\\",\\\"false\\\"],[\\\"data-context-name\\\",\\\"Naledi\\\"],[\\\"data-context-selected\\\",\\\"false\\\"],[\\\"data-object-navigate-activation\\\",\\\"click\\\"]]@0>u.context-caption[[\\\"data-context-name\\\",\\\"Naledi\\\"]]@0\",\"count\"]",
    "allowed": [
      7,
      8
    ],
    "reason": "Locked native host selection publishes exactly these two Naledi caption histories (seven/eight writes); the longer history adds one initial transform before the shared suffix. Other subjects, properties and endpoints stay exact."
  },
  {
    "id": "beta-pictoris-system",
    "step": "select-host",
    "measure": "[\"dom\",\"document>html.[[\\\"data-scene-presented\\\",\\\"true\\\"]]@0>body.[[\\\"data-object-shell\\\",\\\"beta-pictoris\\\"]]@0>div.object-viewport[]@0>div.object-world-stage[]@0>div.prepared-world-context[[\\\"data-world-context\\\",\\\"sun\\\"]]@0>b.context-mover[]@18>s.[[\\\"data-context-annotations-animate\\\",\\\"false\\\"],[\\\"data-context-body\\\",\\\"wasp-62\\\"],[\\\"data-context-body-visible\\\",\\\"true\\\"],[\\\"data-context-group\\\",\\\"wasp-62\\\"],[\\\"data-context-indicator-visible\\\",\\\"false\\\"],[\\\"data-context-label\\\",\\\"wasp-62\\\"],[\\\"data-context-label-case\\\",\\\"upper\\\"],[\\\"data-context-label-visible\\\",\\\"false\\\"],[\\\"data-context-name\\\",\\\"Naledi\\\"],[\\\"data-context-selected\\\",\\\"false\\\"],[\\\"data-object-navigate-activation\\\",\\\"click\\\"]]@0>u.context-caption[[\\\"data-context-name\\\",\\\"Naledi\\\"]]@0\",\"writes\"]",
    "allowed": [
      [
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -14.3877px)",
          "before": null,
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -12.5289px)",
          "before": "translate(12px, -14.3877px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -11.1105px)",
          "before": "translate(12px, -12.5289px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -10.4159px)",
          "before": "translate(12px, -11.1105px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -9.84304px)",
          "before": "translate(12px, -10.4159px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -9.30551px)",
          "before": "translate(12px, -9.84304px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -9px)",
          "before": "translate(12px, -9.30551px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        }
      ],
      [
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -16.5366px)",
          "before": null,
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -14.3877px)",
          "before": "translate(12px, -16.5366px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -12.5289px)",
          "before": "translate(12px, -14.3877px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -11.1105px)",
          "before": "translate(12px, -12.5289px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -10.4159px)",
          "before": "translate(12px, -11.1105px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -9.84304px)",
          "before": "translate(12px, -10.4159px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -9.30551px)",
          "before": "translate(12px, -9.84304px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        },
        {
          "key": "u.context-caption[data-context-name] { transform }",
          "value": "translate(12px, -9px)",
          "before": "translate(12px, -9.30551px)",
          "moving": false,
          "coasting": false,
          "classification": "ALLOWED/REST"
        }
      ]
    ],
    "reason": "Locked native host selection publishes exactly these two Naledi caption histories (seven/eight writes); the longer history adds one initial transform before the shared suffix. Other subjects, properties and endpoints stay exact."
  }
]);
export function variationsFor(id: string) { return knownVariations.filter(row => row.id === id); }
/** Raw values stay in *.raw.json; comparison uses this exact finite set, not a range or mask. */
export function applyKnownVariations(trace: Trace): Trace {
  const declared = variationsFor(trace.journey);
  if (trace.knownVariations && exact(json(trace.knownVariations)) !== exact(json(declared))) throw new Error('Trace variation differs from tracked declaration');
  const copy = structuredClone(trace);
  copy.knownVariations = declared.map(row => json(row));
  for (const declaration of declared) {
    const measure: unknown = JSON.parse(declaration.measure);
    if (!Array.isArray(measure) || !measure.every(value => typeof value === 'string')) throw new Error('Invalid tracked measure');
    const [family, subject, field] = measure;
    const rows = family === 'network' ? copy.observations.network : family === 'dom' ? copy.observations.dom : family === 'content' ? copy.observations.content : copy.observations.rendering;
    const matches = rows.filter(row => row.step === declaration.step && row.data && typeof row.data === 'object' && !Array.isArray(row.data) && (row.data.url === subject || row.data.subject === subject));
    if (matches.length !== 1 || !field) throw new Error('Missing or ambiguous known measure: ' + declaration.measure);
    const data = matches[0]!.data;
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.hasOwn(data, field)) throw new Error('Missing known field');
    const token = { knownVariation: declaration.measure, allowed: declaration.allowed };
    const marker = Array.isArray(declaration.allowed[0]) ? [token] : token;
    const observed = data[field];
    if (observed === undefined) throw new Error('Missing known value');
    if (exact(observed) === exact(marker) && trace.knownVariations) continue;
    if (!declaration.allowed.some(value => exact(value) === exact(observed))) throw new Error('Known variation outside allowed set: ' + declaration.measure);
    data[field] = marker;
  }
  return copy;
}
