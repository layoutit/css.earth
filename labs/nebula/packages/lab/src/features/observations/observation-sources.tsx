import type { SourceDossier } from './models/source-dossier';
import type { Observation } from './models/model';

/** Source quality stays beside the candidate; papers describe future constraints, not completed fits. */
export function ObservationSources({ data, image }: { data: SourceDossier; image: Observation }) {
  const source = data.images.find(row => row.id === image.id);
  return <section className="observation-source-info" aria-label="Image quality and limits">
    {source && <>
      <p className="overlay-detail">{source.wavelengths}</p>
      <p className="overlay-detail">{image.source.width.toLocaleString()} × {image.source.height.toLocaleString()} px · {source.coverage}</p>
      <p className="overlay-detail">{source.quality}</p>
      <details><summary>Image quality</summary>
        {source.epoch && <p className="overlay-detail">Epoch: {source.epoch}</p>}
        {source.notes.map(note => <p className="overlay-detail" key={note}>{note}</p>)}
      </details>
    </>}
    {data && <details><summary>Evidence limits</summary>
      <p className="overlay-detail">{data.summary}</p>
      {data.papers.map(paper => <article key={paper.url}>
        {paper.constraints.map(note => <p key={note} className="overlay-detail">{note}</p>)}
      </article>)}
    </details>}
  </section>;
}
