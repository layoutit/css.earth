import { useEffect, useState } from 'react';
import { readSourceDossier, type SourceDossier } from '../alignment/observations-ui/source-dossier';
import { localFile } from '../viewer/viewer';
import type { Observation } from '../alignment/observations-ui/model';

/** Source quality stays beside the candidate; papers describe future constraints, not completed fits. */
export function ObservationSources({ path, image }: { path: string; image: Observation }) {
  const [data, setData] = useState<SourceDossier | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    void fetch(localFile(path), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(`Source information unavailable (${response.status}).`);
      const next = readSourceDossier(await response.json());
      if (!controller.signal.aborted) setData(next);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Source information unavailable.'); });
    return () => controller.abort();
  }, [path]);
  const source = data?.images.find(row => row.id === image.id);
  return <section className="observation-source-info" aria-label="Source information">
    {error && <p role="alert" className="overlay-detail">{error}</p>}
    {source && <>
      <p className="overlay-detail"><strong>{source.provider} · {source.telescope}</strong><br />{source.wavelengths}</p>
      <p className="overlay-detail">{image.source.width.toLocaleString()} × {image.source.height.toLocaleString()} px · {source.coverage}</p>
      <p className="overlay-detail">{source.quality}</p>
      <details><summary>Image details & credit</summary>
        {source.epoch && <p className="overlay-detail">Epoch: {source.epoch}</p>}
        {source.notes.map(note => <p className="overlay-detail" key={note}>{note}</p>)}
        <p className="overlay-detail">{image.source.credit}</p>
        <div className="placement-actions"><a href={image.source.page} target="_blank" rel="noreferrer">Publisher ↗</a>
          {source.masterUrl && <a href={source.masterUrl} target="_blank" rel="noreferrer">Master image ↗</a>}</div>
      </details>
    </>}
    {data && <details><summary>Papers & constraints · {data.papers.length}</summary>
      <p className="overlay-detail">{data.summary}</p>
      {data.papers.map(paper => <article key={paper.url}>
        <a href={paper.url} target="_blank" rel="noreferrer">{paper.title} ({paper.year}) ↗</a>
        <p className="overlay-detail">{paper.access}</p>
        {paper.constraints.map(note => <p key={note} className="overlay-detail">{note}</p>)}
      </article>)}
    </details>}
  </section>;
}
