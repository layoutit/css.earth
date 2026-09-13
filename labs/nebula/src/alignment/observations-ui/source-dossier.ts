export interface SourceDossier {
  objectId: string; summary: string;
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
  return { objectId: text(row.objectId), summary: text(row.summary), images, papers: list(row.papers).map(value => {
    const r = record(value);
    if (typeof r.year !== 'number' || !Number.isInteger(r.year)) throw new TypeError('Invalid paper year.');
    return { title: text(r.title), url: link(r.url), year: r.year, access: text(r.access), constraints: list(r.constraints).map(text) };
  }) };
}
