import { useEffect, useMemo, useState } from 'react';
import { archiveProviders, readArchiveQuery, readMessierCatalogue, readMessierInventory, type ArchiveImage, type ArchiveProvider,
  type ArchiveQuery, type MessierCatalogue, type MessierInventory, type MessierObject } from './types';
import { imageSuitability, inventoryStorage } from './selection';
import './catalogue.css';

declare const __NEBULA_REPO_ROOT__: string;
const localFile = (path: string) => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
const cataloguePath = 'labs/nebula/models/messier/catalogue.json';
const inventoryPath = '.local/nebula-lab/catalogue/messier/index.json';
const names: Record<ArchiveProvider, string> = { mast: 'MAST', irsa: 'IRSA', eso: 'ESO' };
const bands = { all: 'All wavelengths', optical: 'Optical', infrared: 'Infrared', ultraviolet: 'Ultraviolet', radio: 'Radio / microwave', highEnergy: 'X-ray / gamma', unknown: 'Unreported' } as const;
type Band = keyof typeof bands;
type ImageRole = ReturnType<typeof imageSuitability>['role'];
const roleLabels: Record<ImageRole, string> = { detail: 'Detail candidate', context: 'Context candidate', unrated: 'Unrated' };
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
  const [resolution, setResolution] = useState('all'), [productSearch, setProductSearch] = useState('');
  const [reload, setReload] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const onHistory = () => setSelectedId(readObjectId()); window.addEventListener('popstate', onHistory);
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
      setCatalogue(objects.value.data);
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
  const types = useMemo(() => [...new Set(catalogue?.objects.map(object => object.type) ?? [])].sort(), [catalogue]);
  const objects = useMemo(() => {
    const query = objectSearch.trim().toLowerCase().replace(/^m\s+(\d+)$/, 'm$1');
    return (catalogue?.objects ?? []).filter(object => (objectType === 'all' || object.type === objectType) &&
      `${object.id} ${object.name} ${object.aliases.join(' ')}`.toLowerCase().includes(query)).sort((a, b) => a.messier - b.messier);
  }, [catalogue, objectSearch, objectType]);
  const target = inventory?.targets.find(item => item.objectId === selectedId);
  const selectedQueries = useSelectedQueries(target, reload);
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
      matchesBand(image, band) && (imageRole === 'all' || selected && imageSuitability(image, selected).role === imageRole) &&
      (resolution === 'all' || image.resolutionArcsec !== null && image.resolutionArcsec <= Number(resolution)) &&
      `${image.title} ${image.id} ${image.collection} ${image.facility} ${image.instrument}`.toLowerCase().includes(query));
  }, [selectedQueries, band, imageRole, selected, resolution, productSearch]);
  const selectionKey = `${selectedId}:${band}:${imageRole}:${resolution}:${productSearch}`;
  return <>
    <header className="lab-header catalogue-header"><h1>Nebula Lab</h1><span className="catalogue-heading">Messier catalogue</span>
      <nav aria-label="Lab navigation"><a href="/alignment" target="_blank" rel="noreferrer">Open lab ↗</a><a href="/catalogue" aria-current="page">Catalogue</a></nav>
    </header>
    <main className="catalogue-layout">
      <aside className="catalogue-objects" aria-label="Messier objects">
        <label className="catalogue-field">Find object<input type="search" value={objectSearch} onChange={event => setObjectSearch(event.target.value)} placeholder="M42, Orion, NGC…" /></label>
        <label className="catalogue-field">Object type<select value={objectType} onChange={event => setObjectType(event.target.value)}>
          <option value="all">All types</option>{types.map(type => <option key={type}>{type}</option>)}</select></label>
        <div className="catalogue-object-count"><span>{objects.length} of {catalogue?.objects.length ?? '…'} objects</span><span>Messier</span></div>
        <select className="catalogue-object-select" aria-label="Select Messier object" size={18} value={objects.some(object => object.id === selectedId) ? selectedId : ''}
          onChange={event => chooseObject(event.target.value)} disabled={!catalogue}>
          {!objects.some(object => object.id === selectedId) && <option value="" disabled hidden>Select an object</option>}
          {objects.map(object => <option key={object.id} value={object.id}>{`M${object.messier} · ${object.name}`}</option>)}
        </select>
      </aside>
      <section className="catalogue-detail" aria-label="Archive image candidates">
        {selected && catalogue && <ObjectHeading object={selected} catalogue={catalogue} />}
        <div className="catalogue-status">
          <span role={error ? 'alert' : 'status'}>{error || (loading ? 'Reading local snapshot…' : missing ? 'No archive snapshot yet.' :
            `${completeCount} of ${queries.length} queries complete${partialCount ? ` · ${partialCount} partial` : ''}${errorCount ? ` · ${errorCount} failed` : ''}`)}</span>
          <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading}>Reload snapshot</button>
          {inventory && <span className="catalogue-updated" title={`Snapshot ${inventory.generatedAt}${error ? '; previous snapshot remains visible' : ''}`}>{error ? 'Showing previous snapshot · ' : ''}{new Date(inventory.generatedAt).toLocaleString()}</span>}
        </div>
        {!selected && !loading && catalogue && <p className="catalogue-empty" role="status">Choose a Messier object from the catalogue.</p>}
        {selected && <>
          <div className="catalogue-filters">
            <div className="catalogue-archive-filters" role="group" aria-label="Filter archive">
              <button type="button" aria-pressed={provider === 'all'} onClick={() => setProvider('all')}>All archives</button>
              {archiveProviders.map(archive => <button key={archive} type="button" aria-pressed={provider === archive} onClick={() => setProvider(archive)}>{names[archive]}</button>)}
            </div>
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
            {(provider === 'all' ? archiveProviders : [provider]).map(archive => <ArchiveGroup key={`${selectionKey}:${archive}`} provider={archive}
              object={selected} query={target?.queries.find(query => query.provider === archive)} page={selectedQueries[archive]} images={filtered.filter(image => image.provider === archive)} />)}
            <p className="catalogue-footer" title={inventory?.policy ?? 'Archive metadata is collected by the explicit catalogue inventory command.'}>
              {candidateCount} candidate records · metadata only · advertised sizes may be incomplete. Preview and data links open separately; browsing starts no processing.
            </p>
            {storage && <p className="catalogue-footer" title="Deduplicated archive-advertised file sizes across the entire inventory, not downloaded bytes. Unknown sizes and incomplete queries make this a lower bound.">
              Inventory: {storage.uniqueImages.toLocaleString()} unique products · advertised data {storage.isLowerBound ? '≥ ' : ''}{bytes(storage.estimatedBytes)}
              {storage.unknownSizes ? ` · ${storage.unknownSizes.toLocaleString()} sizes unreported` : ''}
            </p>}
          </div>
        </>}
      </section>
    </main>
  </>;
}

function ObjectHeading({ object, catalogue }: { object: MessierObject; catalogue: MessierCatalogue }) {
  const sources = catalogue.sources.filter(source => object.sourceIds.includes(source.id));
  return <>
    <div className="catalogue-object-heading"><div><h2>{`M${object.messier} · ${object.name}`}</h2><p>{object.type}{object.aliases.length ? ` · ${object.aliases.join(' · ')}` : ''}</p></div>
      <div className="catalogue-object-links">{sources.map(source => <a href={source.url} key={source.id} target="_blank" rel="noreferrer" title={source.credit}>{source.id} ↗</a>)}</div>
    </div>
    <div className="catalogue-object-facts"><span title="Catalogue ICRS coordinates; not a fitted image registration.">RA {object.raDegrees.toFixed(5)}° · Dec {object.decDegrees.toFixed(5)}°</span>
      <span title={object.notes ?? 'Catalogue reference extent. This does not establish that an archive image includes all surrounding nebulosity.'}>Catalogue extent {object.majorArcmin === null ? 'unreported' : `${object.majorArcmin}′${object.minorArcmin !== null ? ` × ${object.minorArcmin}′` : ''}`}</span>
      {object.notes && <span title={object.notes}>Source scope ⓘ</span>}
    </div>
  </>;
}
function ArchiveGroup({ provider, query, page: loaded, images, object }: { provider: ArchiveProvider; query?: ArchiveQuery; page?: LoadedQuery; images: ArchiveImage[]; object: MessierObject }) {
  const [page, setPage] = useState(0), limit = 25;
  const sorted = useMemo(() => [...images].sort((a, b) => (a.resolutionArcsec ?? Infinity) - (b.resolutionArcsec ?? Infinity) || (b.fieldDegrees ?? 0) - (a.fieldDegrees ?? 0) || a.id.localeCompare(b.id)), [images]);
  const pages = Math.max(1, Math.ceil(sorted.length / limit)), actualPage = Math.min(page, pages - 1);
  const displayed = sorted.slice(actualPage * limit, (actualPage + 1) * limit);
  const count = query?.imageCount ?? query?.images.length ?? 0;
  return <section className="catalogue-archive" aria-label={`${names[provider]} candidates`} aria-busy={loaded?.loading ?? false}>
    <div className="catalogue-archive-heading"><h3>{names[provider]}</h3>
      <span className="catalogue-archive-status" data-status={query?.status ?? 'pending'} title={query?.queriedAt ? `Selected metadata query at ${query.queriedAt}. Query complete does not mean every archive holding was searched.` : 'No completed metadata query yet.'}>{queryStatus(query)}</span>
      {query && <span className="catalogue-archive-status">{images.length} shown / {count} cached{query.matchedCount !== null ? ` / ${query.matchedCount} matched` : ''}</span>}
      {query && <span className="catalogue-archive-status" title="Archive-advertised size total for matching query records; unknown sizes are excluded, not zero.">Query estimate {bytes(query.matchedEstimatedBytes)}{query.matchedUnknownSizeCount === null ? ' · unknown-size count unreported' : query.matchedUnknownSizeCount ? ` + ${query.matchedUnknownSizeCount} unknown sizes` : ''}</span>}
    </div>
    {query?.status === 'error' && <p className="catalogue-archive-note" role="alert">{query.error}</p>}
    {loaded?.loading && <p className="catalogue-archive-note" role="status">Reading image records…</p>}
    {loaded?.error && <p className="catalogue-archive-note" role="alert">{loaded.error}{loaded.query ? ' Showing the previously verified records.' : ''}</p>}
    {query?.status === 'truncated' && <p className="catalogue-archive-note">The archive query hit a result limit; this is a partial inventory.</p>}
    {!displayed.length ? !loaded?.loading && !loaded?.error && <p className="catalogue-empty">{!query || query.status === 'pending' ? 'Awaiting archive query.' : count ? 'No images match these filters.' : query.status === 'error' ? 'No cached image records.' : 'No images returned by this query.'}</p> : <>
      <table className="catalogue-product-table"><caption className="visually-hidden">{names[provider]} image candidates, ordered by reported angular resolution.</caption>
        <thead><tr><th scope="col">Image / wavelength</th><th scope="col">Resolution / dimensions</th><th scope="col">Coverage / file size</th><th scope="col">Links</th></tr></thead>
        <tbody>{displayed.map(image => <ImageRow key={image.id} image={image} object={object} />)}</tbody>
      </table>
      {pages > 1 && <div className="catalogue-pagination"><button type="button" disabled={actualPage === 0} onClick={() => setPage(actualPage - 1)} aria-label={`Previous ${names[provider]} page`}>Previous</button>
        <span>{actualPage + 1} / {pages}</span><button type="button" disabled={actualPage >= pages - 1} onClick={() => setPage(actualPage + 1)} aria-label={`Next ${names[provider]} page`}>Next</button></div>}
    </>}
  </section>;
}
function ImageRow({ image, object }: { image: ArchiveImage; object: MessierObject }) {
  const suitability = imageSuitability(image, object);
  return <tr data-image-id={image.id}>
    <td><h4 className="catalogue-product-title">{image.title || image.id}</h4><span className="catalogue-product-meta">{[image.collection, image.facility, image.instrument].filter(Boolean).join(' · ')}</span>
      <span className="catalogue-product-meta">{wavelength(image)}{image.exposureSeconds !== null ? ` · ${image.exposureSeconds.toLocaleString()} s` : ''}</span>
      <span className="catalogue-product-meta" title="Metadata estimate only. Detail compares reported angular resolution with the catalogue extent, not the image's usable structure or accepted quality.">{roleLabels[suitability.role]}</span></td>
    <td>{image.resolutionArcsec === null ? 'Unreported' : `${image.resolutionArcsec.toLocaleString(undefined, { maximumSignificantDigits: 3 })}″`}
      <span className="catalogue-product-meta">{image.width && image.height ? `${image.width.toLocaleString()} × ${image.height.toLocaleString()} px` : 'Pixel dimensions unreported'}</span></td>
    <td title="Reported field diameter and archive-advertised size. Neither establishes complete nebula coverage.">FOV {angle(image.fieldDegrees)}
      <span className="catalogue-product-meta">{bytes(image.estimatedBytes)}{image.accessFormat ? ` · ${image.accessFormat}` : ''}</span>
      {suitability.fieldRatio !== null && <span className="catalogue-product-meta" title="Reported field diameter divided by the catalogue reference extent. Image centering and full nebula coverage still require inspection.">{suitability.fieldRatio < 1 ? 'Local field' : 'Wider field'} · {suitability.fieldRatio.toFixed(2)}× extent</span>}
      {image.raDegrees !== null && image.decDegrees !== null && <span className="catalogue-product-meta" title="Reported ICRS image center, retained for later sky registration.">{image.raDegrees.toFixed(4)}°, {image.decDegrees.toFixed(4)}°</span>}
      {image.footprint && <span className="catalogue-product-meta" title={image.footprint}>Sky footprint available ⓘ</span>}</td>
    <td><div className="catalogue-product-links"><a href={image.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>
      {image.previewUrl && <a href={image.previewUrl} target="_blank" rel="noreferrer">Preview ↗</a>}
      {image.accessUrl && <a href={image.accessUrl} target="_blank" rel="noreferrer" title={`Open archive data link; advertised size ${bytes(image.estimatedBytes)}.`}>Data ↗</a>}</div></td>
  </tr>;
}
