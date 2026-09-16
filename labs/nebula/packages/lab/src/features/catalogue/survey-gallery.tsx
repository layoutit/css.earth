import { useEffect, useRef, useState } from 'react';
import type { MessierObject } from './types';
import { surveyImages, surveyFieldDegrees, surveyImageUrl, type SurveyImage } from './survey-images';

function SurveyPreview({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  return <div className="catalogue-survey-preview" aria-busy={state === 'loading'}>
    {state !== 'failed' && <img src={url} alt={title} onLoad={() => setState('ready')} onError={() => setState('failed')} />}
    {state !== 'ready' && <span role="status">{state === 'failed' ? 'Preview unavailable from CDS. Retry or open the survey source.' : 'Loading survey image…'}</span>}
    {state === 'failed' && <button type="button" onClick={() => setState('loading')}>Retry preview</button>}
  </div>;
}
export function SurveyGallery({ object, majorArcsec }: { object: MessierObject; majorArcsec: number | null }) {
  const field = surveyFieldDegrees(majorArcsec), [opened, setOpened] = useState<SurveyImage | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (opened) dialog.current?.showModal(); else dialog.current?.close(); }, [opened]);
  return <section className="catalogue-surveys" aria-label="Survey images">
    <p className="catalogue-survey-note">Centered mosaics · north up · {field.toFixed(2)}° field{majorArcsec === null ? ' (size unknown)' : ' including margin'}.
      <span title="These are rendered sky-survey cutouts, not previews of the archive rows. Colour stretches are for inspection. Native detail and signal differ between surveys; registration and processing acceptance are still required."> Survey resolution limits detail ⓘ</span></p>
    <div className="catalogue-survey-grid">{surveyImages.map(survey => <article key={survey.id} className="catalogue-survey-card">
      <div className="catalogue-survey-open">
        <SurveyPreview key={`${object.id}:${survey.id}:${field}`} url={surveyImageUrl(survey, object, field, 512)} title={`M${object.messier} — ${survey.title}`} />
      </div>
      <h3>{survey.title}</h3><p title={survey.description}>{survey.bands} ⓘ</p>
      <div className="catalogue-product-links"><button type="button" onClick={() => setOpened(survey)}>View image</button>
        <a href={survey.sourceUrl} target="_blank" rel="noreferrer">Survey source ↗</a></div>
      <small>{survey.credit}</small>
    </article>)}</div>
    <dialog ref={dialog} className="catalogue-image-dialog" onClose={() => setOpened(null)} onCancel={() => setOpened(null)}>
      {opened && <><header><h3>M{object.messier} · {opened.title}</h3><button type="button" onClick={() => setOpened(null)}>Close image</button></header>
        <SurveyPreview key={`${object.id}:${opened.id}:large`} url={surveyImageUrl(opened, object, field, 2048)} title={`M${object.messier} — ${opened.title}, enlarged survey view`} />
        <footer>{opened.credit} · 2048px display, native survey detail unchanged · <a href={opened.propertiesUrl} target="_blank" rel="noreferrer">Image metadata ↗</a></footer></>}
    </dialog>
  </section>;
}
