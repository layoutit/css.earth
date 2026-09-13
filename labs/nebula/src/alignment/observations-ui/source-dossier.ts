import type { Observations } from './model';
export interface CandidateSelection { referenceId: string; imageIds: string[]; reason: string }
export interface SourceDossier {
  objectId: string; summary: string;
  selection?: CandidateSelection;
  images: { id: string; provider: string; telescope: string; wavelengths: string; coverage: string; quality: string;
    epoch?: string; masterUrl?: string; notes: string[] }[];
  papers: { title: string; url: string; year: number; access: string; constraints: string[] }[];
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Invalid source dossier record.');
  return v as Record<string, unknown>;
};
const text = (v: unknown): string => { if (typeof v !== 'string' || !v.trim()) throw new TypeError('Missing source dossier text.'); return v; };
const list = (v: unknown): unknown[] => { if (!Array.isArray(v)) throw new TypeError('Invalid source dossier list.'); return v; };
const link = (v: unknown): string => { const s = text(v); if (new URL(s).protocol !== 'https:') throw new TypeError('Source dossier links must use HTTPS.'); return s; };
export function readSourceDossier(value: unknown): SourceDossier {
  const row = record(value);
  const images = list(row.images).map(value => {
    const r = record(value);
    return { id: text(r.id), provider: text(r.provider), telescope: text(r.telescope), wavelengths: text(r.wavelengths),
      coverage: text(r.coverage), quality: text(r.quality), notes: list(r.notes).map(text),
      ...(r.epoch === undefined ? {} : { epoch: text(r.epoch) }), ...(r.masterUrl === undefined ? {} : { masterUrl: link(r.masterUrl) }) };
  });
  if (new Set(images.map(r => r.id)).size !== images.length) throw new TypeError('Duplicate dossier image.');
  let selection: CandidateSelection | undefined;
  if (row.selection !== undefined) {
    const s = record(row.selection), imageIds = list(s.imageIds).map(text), referenceId = text(s.referenceId);
    if (!imageIds.length || new Set(imageIds).size !== imageIds.length || !imageIds.includes(referenceId) ||
        imageIds.some(id => !images.some(image => image.id === id))) throw new TypeError('Invalid candidate selection.');
    selection = { referenceId, imageIds, reason: text(s.reason) };
  }
  return { objectId: text(row.objectId), summary: text(row.summary), ...(selection ? { selection } : {}), images, papers: list(row.papers).map(value => {
    const r = record(value);
    if (typeof r.year !== 'number' || !Number.isInteger(r.year)) throw new TypeError('Invalid paper year.');
    return { title: text(r.title), url: link(r.url), year: r.year, access: text(r.access), constraints: list(r.constraints).map(text) };
  }) };
}

/** Only the named sky anchor may lack a relative fit. Selection never upgrades its status. */
export function selectObservationCandidates(data: Observations, selection?: CandidateSelection): Observations {
  if (!selection) return data;
  const images = selection.imageIds.map(id => {
    const image = data.images.find(image => image.id === id);
    if (!image) throw new TypeError(`Selected candidate ${id} is not prepared.`);
    if (id !== selection.referenceId && image.registration.status !== 'verified') throw new TypeError(`Selected candidate ${id} has no verified alignment.`);
    return image;
  });
  return { ...data, images };
}
