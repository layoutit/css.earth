/** **Stars**: the real Gaia stars on the shown nebula's picture (`stars <id>`, `.local/stars-cone.json`), drawn by the
 * site's catalogue-point renderer on the nebula's sky plane. Pressing it with no stars fetched yet runs `stars <id>`; the
 * progress strip shows the run. */
import { useEffect, useState } from 'react';
import { isRecord } from '@cssearth/core';
import type { PreparedCataloguePoints } from '@cssearth/objects';
import { subjects } from '../legacy-viewer/controller';
import { runLabCommand } from '../../ui/lab-run';
import { InfoTip } from '../../ui/info-tip';
import type { LabControlsProps } from '../../state/use-lab-controller';

type Read = { points: PreparedCataloguePoints; count: number } | { missing: string };
async function readStars(object: string, signal?: AbortSignal): Promise<Read> {
  const response = await fetch(`/__nebula/stars?object=${encodeURIComponent(object)}`, { cache: 'no-store', signal });
  const body: unknown = await response.json();
  if (!response.ok || !isRecord(body)) throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `stars unavailable (${response.status}).`);
  if (typeof body.missing === 'string') return { missing: body.missing };
  return { points: body.points as PreparedCataloguePoints, count: Number(body.count) };
}

export function FieldStarsToggle({ shell, controller }: LabControlsProps) {
  const subject = subjects.find(item => item.id === (shell.subjectId ?? shell.objectId));
  const object = (subject?.plates?.object ?? subject?.siteVolume?.object ?? '').replace(/^src\/objects\//, '');
  const [on, setOn] = useState(false), [state, setState] = useState<'idle' | 'loading' | 'fetching' | 'shown' | 'error'>('idle'), [detail, setDetail] = useState('');
  // Shown stars follow the object: a reloaded or changed subject reads its own.
  useEffect(() => {
    if (!on || !object || shell.busy) return;
    const abort = new AbortController();
    void (async () => {
      try {
        setState('loading');
        let read = await readStars(object, abort.signal);
        if ('missing' in read) { setState('fetching'); await runLabCommand({ command: 'stars', object }, abort.signal); read = await readStars(object, abort.signal); }
        if ('missing' in read) throw new Error(`No stars after ${read.missing}.`);
        if (abort.signal.aborted) return;
        await controller.current?.setFieldStars(read.points);
        setState('shown'); setDetail(`${read.count} Gaia stars`);
      } catch (reason) { if (!abort.signal.aborted) { setState('error'); setDetail(reason instanceof Error ? reason.message : String(reason)); } }
    })();
    return () => abort.abort();
  }, [on, object, shell.busy, shell.subjectId, controller]);
  // Leaving Edit hides them: the toggle that shows them lives here.
  useEffect(() => () => { void controller.current?.setFieldStars(null); }, [controller]);
  const toggle = () => {
    if (on) { setOn(false); setState('idle'); setDetail(''); void controller.current?.setFieldStars(null); } else setOn(true);
  };
  const label = state === 'fetching' ? 'Fetching…' : state === 'loading' ? 'Stars…' : 'Stars';
  return <InfoTip content={detail || (object ? `Gaia DR3 stars on the picture (run.mts stars ${object})` : 'Stars need a nebula object.')}>
    <button id="field-stars-toggle" type="button" data-camera-action="stars" aria-label="Stars" aria-pressed={on} aria-disabled={!object}
      data-stars-state={state} data-stars-count={state === 'shown' ? detail.split(' ')[0] : undefined}
      onClick={() => { if (object) toggle(); }}><span aria-hidden="true">✦</span><span>{label}</span></button>
  </InfoTip>;
}
