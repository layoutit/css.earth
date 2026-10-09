import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** A lab-only comparison picture the server lists from `src/objects/<owner>/.local/candidates/` (see
 * `server/workflows/plates/candidate-pictures.ts`). */
export interface CandidatePicture {
  id: string; label: string; kind: string; credit: string; license: string; sourceUrl: string; registration: string;
  registered: boolean; approximate?: boolean; widthPx: number; heightPx: number; pixelArcsec: number; shownPixelArcsec: number;
  fieldArcsec: [number, number]; reachArcsec: number; reachRings: number; outline: [number, number][];
}

/** The candidates the lab keeps for a plate object; none when the object has no candidate set. */
export function useCandidatePictures(object: string) {
  const [candidates, setCandidates] = useState<CandidatePicture[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/__nebula/plate-candidates?object=${encodeURIComponent(object)}`, { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<{ candidates?: CandidatePicture[] }> : { candidates: [] })
      .then(body => setCandidates(Array.isArray(body.candidates) ? body.candidates : []))
      .catch(() => { if (!controller.signal.aborted) setCandidates([]); });
    return () => controller.abort();
  }, [object]);
  return candidates;
}

/** The 153″ forward-shock circle about the target, in the candidate's own pixels inside its registered plane. */
export function CandidateOutline({ candidate, plane }: { candidate: CandidatePicture; plane: HTMLElement }) {
  const stroke = Math.max(1.5, 153 / candidate.shownPixelArcsec / 60);
  return createPortal(<svg className="plate-model-overlay" viewBox={`0 0 ${candidate.widthPx} ${candidate.heightPx}`} aria-hidden="true" data-candidate-outline={candidate.id}
    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
    <polygon points={candidate.outline.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#f0c27a" strokeWidth={stroke} strokeDasharray={`${stroke * 4} ${stroke * 2.5}`} />
  </svg>, plane);
}
