/** Small extracted data only; science files remain the responsibility of retrieval. */
export interface SpectrumPreview {
  readonly kind: 'spectrum'; readonly x: readonly number[]; readonly y: readonly number[];
  readonly xunit: string; readonly yunit: string;
}
export interface ImagePreview { readonly kind: 'image'; readonly grid: readonly (readonly number[])[]; readonly caption: string }
export interface NoPreview { readonly kind: 'none'; readonly reason: string }
export type PreviewData = SpectrumPreview | ImagePreview | NoPreview;
export type PreviewState = PreviewData | { readonly kind: 'loading' } | { readonly kind: 'failed'; readonly reason?: string };
interface PickSource { readonly pick: number; readonly observation: string }
export type PreviewSource = PickSource & (
  | { readonly kind: 'none'; readonly reason: string }
  | { readonly kind: 'hst'; readonly obsId: string }
  | { readonly kind: 'eso'; readonly url: string; readonly product: 'spectrum' | 'image'; readonly instrument: string }
  | { readonly kind: 'alma'; readonly member: string; readonly target: string; readonly spw?: number; readonly ra: number; readonly dec: number }
);
export const NO_PREVIEW = 'the archive has no preview for this one';
export const METADATA_BYTES = 2 * 1024 * 1024;
export const HST_BYTES = 5 * 1024 * 1024;
export const ESO_BYTES = 15 * 1024 * 1024;
export const ALMA_BYTES = 15 * 1024 * 1024;
