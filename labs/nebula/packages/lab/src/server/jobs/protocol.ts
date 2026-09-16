export interface JobRequest { imageId: string; action: string }
export interface JobProgress { stage: string; current: number; total: number; message: string }
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, text: string) { super(text); this.status = status; }
}
export const jobErrorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Processing failed.';
