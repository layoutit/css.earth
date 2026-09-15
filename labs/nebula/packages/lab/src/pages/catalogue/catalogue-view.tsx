import { useEffect, useMemo, useState } from 'react';
import { archiveProviders, readArchiveQuery, readMessierCatalogue, readMessierInventory, type ArchiveImage, type ArchiveProvider,
  type ArchiveQuery, type MessierCatalogue, type MessierInventory, type MessierObject } from '../../features/catalogue/types';
import { imageSuitability, inventoryStorage } from '../../features/catalogue/selection';
import { imageLinks } from '@cssearth/nebula-reconstruction/observations/image-links';
import { SurveyGallery } from '../../features/catalogue/survey-gallery';
import { PapersView } from '../../features/catalogue/papers/papers-view';
import { imageRank, rankImages, type ImageOrder } from '@cssearth/nebula-reconstruction/observations/image-ranking';
import { readMessierPresentation } from '../../features/catalogue/presentation';
import { arcseconds, CatalogueThumbnail, displayObjectType, ObjectBrowser, objectExtent, orderObjects, type ObjectAppearance, type ObjectSort } from '../../features/catalogue/object-browser';
import './catalogue.css';

declare const __NEBULA_REPO_ROOT__: string;
const localFile = (path: string) => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
const cataloguePath = 'labs/nebula/models/messier/catalogue.json';
const inventoryPath = '.local/nebula-lab/catalogue/messier/index.json';
const names: Record<ArchiveProvider, string> = { mast: 'MAST', irsa: 'IRSA', eso: 'ESO' };
const bands = { all: 'All wavelengths', optical: 'Optical', infrared: 'Infrared', ultraviolet: 'Ultraviolet', radio: 'Radio / microwave', highEnergy: 'X-ray / gamma', unknown: 'Unreported' } as const;
type Band = keyof typeof bands;
type ImageRole = ReturnType<typeof imageSuitability>['role'];
const roleLabels: Record<ImageRole, string> = { detail: 'Fine sampling', context: 'Coarse sampling', unrated: 'Sampling unknown' };
const bandRanges: Record<Exclude<Band, 'all' | 'unknown'>, readonly [number, number]> = {
  optical: [380e-9, 780e-9], infrared: [780e-9, 1e-3], ultraviolet: [10e-9, 380e-9], radio: [1e-3, Infinity], highEnergy: [0, 10e-9],
};
function matchesBand(image: ArchiveImage, band: Band) {
  if (band === 'all') return true;
  const low = image.wavelengthMinMeters ?? image.wavelengthMaxMeters, high = image.wavelengthMaxMeters ?? image.wavelengthMinMeters;
  if (band === 'unknown') return low === null;
  if (low === null || high === null) return false;
  const range = bandRanges[band]; return low <= range[1] && high >= range[0];
}
function bytes(value: number | null) {
  if (value === null) return 'Unreported';
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; let size = value, index = 0;
  while (size >= 1000 && index < units.length - 1) { size /= 1000; index++; }
  return `${size.toLocaleString(undefined, { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}
function wavelength(image: ArchiveImage) {
  const low = image.wavelengthMinMeters, high = image.wavelengthMaxMeters;
  if (low === null && high === null) return 'Wavelength unreported';
  const format = (value: number) => value >= 1e-3 ? `${(value * 1000).toPrecision(3)} mm` : `${(value * 1e6).toPrecision(3)} μm`;
  return low !== null && high !== null && low !== high ? `${format(low)} – ${format(high)}` : format(low ?? high!);
}
function angle(degrees: number | null) {
  if (degrees === null) return 'Unreported';
  return degrees >= 1 ? `${degrees.toFixed(2)}°` : `${(degrees * 60).toFixed(2)}′`;
}
function readImageMode(): 'surveys' | 'archives' | 'papers' {
  const value = new URL(location.href).searchParams.get('view'); return value === 'papers' || value === 'archives' ? value : 'surveys';
}
function readObjectId() { return new URL(location.href).searchParams.get('object') ?? 'm42'; }
function textError(value: unknown) { return value instanceof Error ? value.message : 'Catalogue unavailable.'; }
function queryStatus(query?: ArchiveQuery) {
  if (!query || query.status === 'pending') return 'Pending';
  if (query.status === 'error') return 'Query failed';
  if (query.status === 'truncated') return 'Partial result';
  return 'Query complete';
}

const pageIdentity = (objectId: string, query: ArchiveQuery) => JSON.stringify([objectId,
  ...['provider', 'status', 'queriedAt', 'endpoint', 'query', 'radiusDegrees', 'matchedCount', 'matchedEstimatedBytes',
    'matchedUnknownSizeCount', 'error', 'responseSha256', 'imagesPath', 'imagesSha256', 'imageCount'].map(key => query[key as keyof ArchiveQuery])]);
async function sha256(raw: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), byte => byte.toString(16).padStart(2, '0')).join('');
}
interface LoadedQuery { identity: string; query?: ArchiveQuery; loading: boolean; error?: string }
/** The overview stays compact; only the selected object's referenced records enter the browser. */
function useSelectedQueries(target: MessierInventory['targets'][number] | undefined, reload: number) {
  const [pages, setPages] = useState<Partial<Record<ArchiveProvider, LoadedQuery>>>({});
  useEffect(() => {
    const controller = new AbortController(), references = target?.queries.filter(query => query.imagesPath) ?? [];
    setPages(previous => Object.fromEntries(references.map(query => {
      const identity = pageIdentity(target!.objectId, query), old = previous[query.provider];
      return [query.provider, { identity, query: old?.identity === identity ? old.query : undefined, loading: true }];
    })));
    void Promise.allSettled(references.map(async reference => {
      const objectId = target!.objectId, identity = pageIdentity(objectId, reference);
      const expectedPath = `.local/nebula-lab/catalogue/messier/queries/${objectId}-${reference.provider}.json`;
      if (reference.imagesPath !== expectedPath) throw new Error('Archive records belong to another object.');
      const response = await fetch(localFile(expectedPath), { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`Image records unavailable (${response.status}). Reload the snapshot.`);
      const raw = await response.arrayBuffer();
      if (await sha256(raw) !== reference.imagesSha256) throw new Error('Image records changed since this snapshot. Reload the snapshot.');
      const query = readArchiveQuery(JSON.parse(new TextDecoder().decode(raw)));
      if (query.imagesPath || query.images.length !== reference.imageCount ||
          pageIdentity(objectId, { ...query, imagesPath: reference.imagesPath, imagesSha256: reference.imagesSha256,
            imageCount: reference.imageCount }) !== identity) throw new Error('Image records do not match the selected archive query.');
      return query;
    })).then(results => {
      if (controller.signal.aborted) return;
      setPages(previous => Object.fromEntries(results.map((result, index) => {
        const reference = references[index]!, identity = pageIdentity(target!.objectId, reference), old = previous[reference.provider];
        return [reference.provider, result.status === 'fulfilled' ? { identity, query: result.value, loading: false } :
          { identity, query: old?.identity === identity ? old.query : undefined, loading: false, error: textError(result.reason) }];
      })));
    });
    return () => controller.abort();
  }, [target, reload]);
  return useMemo(() => Object.fromEntries((target?.queries ?? []).map(query => {
    const identity = pageIdentity(target!.objectId, query), page = pages[query.provider];
    return [query.provider, !query.imagesPath ? { identity, query, loading: false } :
      page?.identity === identity ? page : { identity, loading: true }];
  })) as Partial<Record<ArchiveProvider, LoadedQuery>>, [target, pages]);
}

/** Metadata browsing is independent of reconstruction subjects, cloud state and processing jobs. */
export function CatalogueView() {
  const [catalogue, setCatalogue] = useState<MessierCatalogue | null>(null), [inventory, setInventory] = useState<MessierInventory | null>(null);
  const [selectedId, setSelectedId] = useState(readObjectId), [objectSearch, setObjectSearch] = useState(''), [objectType, setObjectType] = useState('all');
  const [provider, setProvider] = useState<ArchiveProvider | 'all'>('all'), [band, setBand] = useState<Band>('all');
  const [imageRole, setImageRole] = useState<ImageRole | 'all'>('all');
  const [imageMode, setImageMode] = useState(readImageMode), [catalogueHash, setCatalogueHash] = useState('');
  function chooseImageMode(mode: 'surveys' | 'archives' | 'papers') {
    setImageMode(mode); const url = new URL(location.href); if (mode === 'surveys') url.searchParams.delete('view'); else url.searchParams.set('view', mode); history.replaceState(history.state, '', url);
  }
  const [imageOrder, setImageOrder] = useState<ImageOrder>('best');
  const [resolution, setResolution] = useState('all'), [productSearch, setProductSearch] = useState('');
  const [reload, setReload] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [appearances, setAppearances] = useState<ReadonlyMap<string, ObjectAppearance>>(new Map());
  const [previewError, setPreviewError] = useState(''), [objectSort, setObjectSort] = useState<ObjectSort>('size');
  useEffect(() => {
    const controller = new AbortController(); setPreviewError('');
    void fetch(localFile('labs/nebula/models/messier/presentation.json'), { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`Sky previews unavailable (${response.status}).`);
        const data = readMessierPresentation(await response.json());
        if (!controller.signal.aborted) setAppearances(new Map(data.objects.map(object => [object.objectId, object])));
      }).catch(reason => { if (!controller.signal.aborted) setPreviewError(textError(reason)); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const onHistory = () => { setSelectedId(readObjectId()); setImageMode(readImageMode()); }; window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setMissing(false);
    async function load() {
      const requests = await Promise.allSettled([
        fetch(localFile(cataloguePath), { cache: 'no-store', signal: controller.signal }).then(async response => {
          if (!response.ok) throw new Error(`Object catalogue unavailable (${response.status}).`);
          const raw = await response.arrayBuffer(), data = readMessierCatalogue(JSON.parse(new TextDecoder().decode(raw)));
          const hash = await sha256(raw);
          return { data, hash };
        }),
        fetch(localFile(inventoryPath), { cache: 'no-store', signal: controller.signal }).then(async response => {
          if (response.status === 404) return null;
          if (!response.ok) throw new Error(`Archive snapshot unavailable (${response.status}).`);
          return readMessierInventory(await response.json());
        }),
      ]);
      if (controller.signal.aborted) return;
      const [objects, snapshot] = requests;
      if (objects.status === 'rejected') { setError(textError(objects.reason)); return; }
      setCatalogue(objects.value.data); setCatalogueHash(objects.value.hash);
      if (snapshot.status === 'rejected') { setInventory(previous => previous?.catalogueSha256 === objects.value.hash ? previous : null); setError(textError(snapshot.reason)); return; }
      if (snapshot.value && snapshot.value.catalogueSha256 !== objects.value.hash) {
        setInventory(null); setError('Archive snapshot belongs to an earlier object catalogue. Rebuild the inventory.'); return;
      }
      setInventory(snapshot.value); setMissing(snapshot.value === null);
    }
    void load().catch(reason => { if (!controller.signal.aborted) setError(textError(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const selected = catalogue?.objects.find(object => object.id === selectedId);
  const candidateObject = useMemo(() => {
    if (!selected) return undefined;
    const extent = objectExtent(selected, appearances.get(selected.id));
    return { ...selected, majorArcmin: extent.majorArcsec === null ? null : extent.majorArcsec / 60 };
  }, [selected, appearances]);
  const types = useMemo(() => [...new Set(catalogue?.objects.map(object => displayObjectType(object, appearances.get(object.id))) ?? [])].sort(), [catalogue, appearances]);
  const objects = useMemo(() => {
    const query = objectSearch.trim().toLowerCase().replace(/^m\s+(\d+)$/, 'm$1');
    return orderObjects((catalogue?.objects ?? []).filter(object => (objectType === 'all' || displayObjectType(object, appearances.get(object.id)) === objectType) &&
      `${object.id} ${object.name} ${object.aliases.join(' ')}`.toLowerCase().includes(query)), objectSort, appearances);
  }, [catalogue, objectSearch, objectType, objectSort, appearances]);
  const target = inventory?.targets.find(item => item.objectId === selectedId);
  const selectedQueries = useSelectedQueries(imageMode === 'archives' ? target : undefined, reload);
  const queries = inventory?.targets.flatMap(item => item.queries) ?? [];
  const completeCount = queries.filter(query => query.status === 'complete').length;
  const partialCount = queries.filter(query => query.status === 'truncated').length, errorCount = queries.filter(query => query.status === 'error').length;
  const candidateCount = target?.queries.reduce((sum, query) => sum + (query.imageCount ?? query.images.length), 0) ?? 0;
  const storage = useMemo(() => inventory ? inventoryStorage(inventory) : null, [inventory]);
  function chooseObject(id: string) {
    if (!catalogue?.objects.some(object => object.id === id)) return;
    setSelectedId(id); const url = new URL(location.href); url.searchParams.set('object', id); history.replaceState(history.state, '', url);
  }
  const filtered = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return Object.values(selectedQueries).flatMap(page => page?.query?.images ?? []).filter(image =>
      matchesBand(image, band) && (imageRole === 'all' || candidateObject && imageSuitability(image, candidateObject).role === imageRole) &&
      (resolution === 'all' || image.resolutionArcsec !== null && image.resolutionArcsec <= Number(resolution)) &&
      `${image.title} ${image.id} ${image.collection} ${image.facility} ${image.instrument}`.toLowerCase().includes(query));
  }, [selectedQueries, band, imageRole, candidateObject, resolution, productSearch]);
  const selectionKey = `${selectedId}:${band}:${imageRole}:${resolution}:${productSearch}:${imageOrder}:${provider}`;
  return <>
    <header className="lab-header catalogue-header"><h1>Nebula Lab</h1><span className="catalogue-heading">Messier catalogue</span>
      <nav aria-label="Lab navigation"><a href="/alignment" target="_blank" rel="noreferrer">Open lab ↗</a><a href="/catalogue" aria-current="page">Catalogue</a></nav>
    </header>
    <main className="catalogue-layout">
      <aside className="catalogue-objects" aria-label="Messier objects">
        <label className="catalogue-field">Find object<input type="search" value={objectSearch} onChange={event => setObjectSearch(event.target.value)} placeholder="M42, Orion, NGC…" /></label>
        <label className="catalogue-field">Object type<select value={objectType} onChange={event => setObjectType(event.target.value)}>
          <option value="all">All types</option>{types.map(type => <option key={type}>{type}</option>)}</select></label>
        <label className="catalogue-field catalogue-sort">Order by<select value={objectSort} onChange={event => {
          const value = event.target.value; if (value === 'size' || value === 'number' || value === 'name') setObjectSort(value);
        }}><option value="size">Largest on sky first</option><option value="number">Messier number</option><option value="name">Name</option></select></label>
        <div className="catalogue-object-count"><span>{objects.length} of {catalogue?.objects.length ?? '…'} objects</span><span title="Apparent major-axis size, in arcseconds. Unknown sizes sort last.">Size (arcsec)</span></div>
        <ObjectBrowser objects={objects} selectedId={selectedId} appearances={appearances} chooseObject={chooseObject} localFile={localFile} />
        {previewError && <span className="catalogue-preview-error" role="status">{previewError}</span>}
      </aside>
      <section className="catalogue-detail" aria-label="Archive image candidates">
        {selected && catalogue && <ObjectHeading object={selected} catalogue={catalogue} appearance={appearances.get(selected.id)} />}
        <div className="catalogue-status">
          <span role={error ? 'alert' : 'status'}>{error || (loading ? 'Reading local snapshot…' : missing ? 'No archive snapshot yet.' :
            `${completeCount} of ${queries.length} queries complete${partialCount ? ` · ${partialCount} partial` : ''}${errorCount ? ` · ${errorCount} failed` : ''}`)}</span>
          <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading}>Reload snapshot</button>
          {inventory && <span className="catalogue-updated" title={`Snapshot ${inventory.generatedAt}${error ? '; previous snapshot remains visible' : ''}`}>{error ? 'Showing previous snapshot · ' : ''}{new Date(inventory.generatedAt).toLocaleString()}</span>}
        </div>
        {!selected && !loading && catalogue && <p className="catalogue-empty" role="status">Choose a Messier object from the catalogue.</p>}
        {selected && <>
          <div className="catalogue-image-modes" role="group" aria-label="Image collection">
            <button type="button" aria-pressed={imageMode === 'surveys'} onClick={() => chooseImageMode('surveys')}>Survey images</button>
            <button type="button" aria-pressed={imageMode === 'archives'} onClick={() => chooseImageMode('archives')}>Archive records</button>
            <button type="button" aria-pressed={imageMode === 'papers'} onClick={() => chooseImageMode('papers')}>Papers</button>
          </div>
          {imageMode === 'surveys' ? <div className="catalogue-candidates"><SurveyGallery key={selected.id} object={selected} majorArcsec={objectExtent(selected, appearances.get(selected.id)).majorArcsec} /></div> : imageMode === 'papers' ? <PapersView key={selected.id} object={selected} catalogueSha256={catalogueHash} localFile={localFile} /> : <>
          <div className="catalogue-filters">
            <div className="catalogue-archive-filters" role="group" aria-label="Filter archive">
              <button type="button" aria-pressed={provider === 'all'} onClick={() => setProvider('all')}>All archives</button>
              {archiveProviders.map(archive => <button key={archive} type="button" aria-pressed={provider === archive} onClick={() => setProvider(archive)}>{names[archive]}</button>)}
            </div>
            <label className="catalogue-field" title="Metadata triage across the selected archives: target footprint, reported sampling and combined products. This is not a visual quality measurement.">Order records<select value={imageOrder} onChange={event => {
              const value = event.target.value; if (value === 'best' || value === 'resolution' || value === 'coverage') setImageOrder(value);
            }}><option value="best">Metadata order</option><option value="resolution">Finest resolution</option><option value="coverage">Widest field</option></select></label>
            <label className="catalogue-field">Wavelength<select value={band} onChange={event => { const next = Object.keys(bands).find(value => value === event.target.value); if (next) setBand(next as Band); }}>
              {Object.entries(bands).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="catalogue-field" title="Provisional role from reported angular resolution and catalogue extent. Close-ups are retained; neither role establishes complete coverage.">Image role<select value={imageRole} onChange={event => {
              const next = event.target.value; if (next === 'all' || next === 'detail' || next === 'context' || next === 'unrated') setImageRole(next);
            }}><option value="all">All roles</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="catalogue-field" title="Reported angular resolution, not a measurement of this nebula's detail or coverage.">Resolution<select value={resolution} onChange={event => setResolution(event.target.value)}>
              <option value="all">Any / unreported</option>{[.2, 1, 5, 15, 60].map(value => <option key={value} value={value}>≤ {value}″</option>)}</select></label>
            <label className="catalogue-field">Find image<input type="search" value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Instrument, collection…" /></label>
          </div>
          <div className="catalogue-candidates">
            {candidateObject && <ArchiveGroup key={selectionKey} provider={provider} object={candidateObject} order={imageOrder}
              queries={(target?.queries ?? []).filter(query => provider === 'all' || query.provider === provider)}
              loaded={selectedQueries} images={filtered.filter(image => provider === 'all' || image.provider === provider)} />}
            <p className="catalogue-footer" title={inventory?.policy ?? 'Archive metadata is collected by the explicit catalogue inventory command.'}>
              {candidateCount} candidate records · metadata only · advertised sizes may be incomplete. Preview and data links open separately; browsing starts no processing.
            </p>
            {storage && <p className="catalogue-footer" title="Deduplicated archive-advertised file sizes across the entire inventory, not downloaded bytes. Unknown sizes and incomplete queries make this a lower bound.">
              Inventory: {storage.uniqueImages.toLocaleString()} unique products · advertised data {storage.isLowerBound ? '≥ ' : ''}{bytes(storage.estimatedBytes)}
              {storage.unknownSizes ? ` · ${storage.unknownSizes.toLocaleString()} sizes unreported` : ''}
            </p>}
          </div>
          </>}
        </>}
      </section>
    </main>
  </>;
}

function ObjectHeading({ object, catalogue, appearance }: { object: MessierObject; catalogue: MessierCatalogue; appearance?: ObjectAppearance }) {
  const sources = catalogue.sources.filter(source => object.sourceIds.includes(source.id));
  const extent = objectExtent(object, appearance), thumbnail = appearance?.thumbnail;
  return <>
    <div className="catalogue-object-heading">
      {thumbnail && <a className="catalogue-object-portrait" href={thumbnail.sourceUrl} target="_blank" rel="noreferrer"
        title={`${thumbnail.credit} · Sky preview field ${arcseconds(thumbnail.fieldArcsec)}. This survey overview is separate from the archive image candidates.`}>
        <CatalogueThumbnail key={object.id} url={thumbnail.localPath ? localFile(thumbnail.localPath) : thumbnail.url} fallback={thumbnail.url} alt={`M${object.messier} sky preview`} />
        <span>Survey source ↗</span></a>}
      <div className="catalogue-object-title"><h2>{`M${object.messier} · ${object.name}`}</h2><p>{displayObjectType(object, appearance)}{object.aliases.length ? ` · ${object.aliases.join(' · ')}` : ''}</p></div>
      <div className="catalogue-object-links">{sources.map(source => <a href={source.url} key={source.id} target="_blank" rel="noreferrer" title={source.credit}>{source.id} ↗</a>)}</div>
    </div>
    <div className="catalogue-object-facts"><span title="Catalogue ICRS coordinates; not a fitted image registration.">RA {object.raDegrees.toFixed(5)}° · Dec {object.decDegrees.toFixed(5)}°</span>
      <span title={`${extent.label}. ${extent.notes ?? 'Reference angular extent, not a measured image boundary.'}`}>Apparent size {extent.majorArcsec === null ? 'unreported' : arcseconds(extent.majorArcsec)}{extent.minorArcsec !== null ? ` × ${arcseconds(extent.minorArcsec)}` : ''}
        {extent.sourceUrl && <> · <a href={extent.sourceUrl} target="_blank" rel="noreferrer">Size source ↗</a></>}</span>
      {appearance?.facts && <span title="Historical NASA HEASARC catalogue values; constellation abbreviation and integrated visual magnitude.">
        <a href={appearance.facts.sourceUrl} target="_blank" rel="noreferrer">Constellation {appearance.facts.constellation}</a>
        {appearance.facts.visualMagnitude !== null && <> · V {appearance.facts.visualMagnitude.toFixed(1)} mag{appearance.facts.magnitudeUncertaintyFlag ? ' (approx.)' : ''}</>}
      </span>}
      {object.notes && <span title={object.notes}>Source scope ⓘ</span>}
    </div>
  </>;
}
function ArchiveGroup({ provider, queries, loaded, images, object, order }: {
  provider: ArchiveProvider | 'all'; queries: ArchiveQuery[]; loaded: Partial<Record<ArchiveProvider, LoadedQuery>>;
  images: ArchiveImage[]; object: MessierObject; order: ImageOrder;
}) {
  const [page, setPage] = useState(0), limit = 25;
  const label = provider === 'all' ? 'All archives' : names[provider];
  const sorted = useMemo(() => rankImages(images, object, order), [images, object, order]);
  const pages = Math.max(1, Math.ceil(sorted.length / limit)), actualPage = Math.min(page, pages - 1);
  const displayed = sorted.slice(actualPage * limit, (actualPage + 1) * limit);
  const count = queries.reduce((sum, query) => sum + (query.imageCount ?? query.images.length), 0);
  const busy = queries.some(query => loaded[query.provider]?.loading);
  const failed = queries.some(query => loaded[query.provider]?.error || query.status === 'error');
  return <section className="catalogue-archive" aria-label={`${label} candidates`} aria-busy={busy}>
    <div className="catalogue-archive-heading"><h3>{label}</h3>
      <span className="catalogue-archive-status">{images.length} shown / {count} cached · {order === 'best' ? 'Metadata order' : order === 'resolution' ? 'Finest resolution' : 'Widest field'}</span>
      {queries.map(query => <span key={query.provider} className="catalogue-archive-status" data-status={query.status}
        title="The result limit and missing metadata constrain this ranking; query completion is not exhaustive archive coverage.">{names[query.provider]}: {queryStatus(query)}</span>)}
    </div>
    {queries.map(query => {
      const record = loaded[query.provider], error = record?.error ?? (query.status === 'error' ? query.error : undefined);
      return error ? <p key={query.provider} className="catalogue-archive-note" role="alert">{names[query.provider]}: {error}{record?.query ? ' Showing previously verified records.' : ''}</p> : null;
    })}
    {busy && <p className="catalogue-archive-note" role="status">Reading image records…</p>}
    {!displayed.length ? !busy && !failed && <p className="catalogue-empty">{!queries.length || queries.every(query => query.status === 'pending') ? 'Awaiting archive query.' : count ? 'No images match these filters.' : 'No images returned by this query.'}</p> : <>
      <table className="catalogue-product-table"><caption className="visually-hidden">{label} image candidates ordered by {order === 'best' ? 'metadata suitability' : order}.</caption>
        <thead><tr><th scope="col">Image / wavelength</th><th scope="col">Resolution / dimensions</th><th scope="col">Coverage / file size</th><th scope="col">Links</th></tr></thead>
        <tbody>{displayed.map(image => <ImageRow key={`${image.provider}:${image.id}`} image={image} object={object} />)}</tbody>
      </table>
      {pages > 1 && <div className="catalogue-pagination"><button type="button" disabled={actualPage === 0} onClick={() => setPage(actualPage - 1)} aria-label={`Previous ${label} page`}>Previous</button>
        <span>{actualPage + 1} / {pages}</span><button type="button" disabled={actualPage >= pages - 1} onClick={() => setPage(actualPage + 1)} aria-label={`Next ${label} page`}>Next</button></div>}
    </>}
  </section>;
}
function ImageRow({ image, object }: { image: ArchiveImage; object: MessierObject }) {
  const suitability = imageSuitability(image, object), links = imageLinks(image), rank = imageRank(image, object);
  return <tr data-image-id={image.id}>
    <td>{image.previewUrl && <a href={image.previewUrl} target="_blank" rel="noreferrer" className="catalogue-product-preview"><CatalogueThumbnail url={image.previewUrl} alt={`${image.title || image.id} archive preview`} /></a>}
      <h4 className="catalogue-product-title">{image.title || image.id}</h4><span className="catalogue-product-meta">{[names[image.provider], image.collection, image.facility, image.instrument].filter(Boolean).join(' · ')}</span>
      <span className="catalogue-product-meta">{wavelength(image)}{image.exposureSeconds !== null ? ` · ${image.exposureSeconds.toLocaleString()} s` : ''}</span>
      <span className="catalogue-product-meta" title="Metadata estimate only. Detail compares reported angular resolution with the catalogue extent, not the image's usable structure or accepted quality.">{roleLabels[suitability.role]}</span>
      <span className="catalogue-product-meta catalogue-rank-reasons" title="Ranking clues from archive metadata; these do not measure image noise, saturation, registration or exact coverage.">{rank.reasons.join(' · ')}</span></td>
    <td>{image.resolutionArcsec === null ? 'Unreported' : `${image.resolutionArcsec.toLocaleString(undefined, { maximumSignificantDigits: 3 })}″`}
      <span className="catalogue-product-meta">{image.width && image.height ? `${image.width.toLocaleString()} × ${image.height.toLocaleString()} px` : 'Pixel dimensions unreported'}</span></td>
    <td title="Reported field diameter and archive-advertised size. Neither establishes complete nebula coverage.">FOV {angle(image.fieldDegrees)}
      <span className="catalogue-product-meta">{bytes(image.estimatedBytes)}{image.accessFormat ? ` · ${image.accessFormat}` : ''}</span>
      {suitability.fieldRatio !== null && <span className="catalogue-product-meta" title="Reported field diameter divided by the catalogue reference extent. Image centering and full nebula coverage still require inspection.">{suitability.fieldRatio < 1 ? 'Local field' : 'Wider field'} · {suitability.fieldRatio.toFixed(2)}× extent</span>}
      {image.raDegrees !== null && image.decDegrees !== null && <span className="catalogue-product-meta" title="Reported ICRS image center, retained for later sky registration.">{image.raDegrees.toFixed(4)}°, {image.decDegrees.toFixed(4)}°</span>}
      {image.footprint && <span className="catalogue-product-meta" title={image.footprint}>Sky footprint available ⓘ</span>}</td>
    <td><div className="catalogue-product-links"><a href={links.sourceUrl} target="_blank" rel="noreferrer"
      title={links.sourceLabel === 'File listing' ? 'Metadata table only; this product has no resolved image preview.' : links.sourceIsViewer ? 'Load the exact FITS in the IRSA viewer; large files may take time.' : 'Published metadata record; it may not include an image.'}>{links.sourceLabel} ↗</a>
      {links.viewUrl && links.viewUrl !== links.sourceUrl && <a href={links.viewUrl} target="_blank" rel="noreferrer">View image ↗</a>}
      {links.filesUrl && links.filesUrl !== links.sourceUrl && <a href={links.filesUrl} target="_blank" rel="noreferrer">Files ↗</a>}
      {links.downloadUrl && <a href={links.downloadUrl} target="_blank" rel="noreferrer" title={`Download original file; advertised size ${bytes(image.estimatedBytes)}.`}>Download{links.fits ? ' FITS' : ''} ↓</a>}</div></td>
  </tr>;
}
