/** Inspection of prepared 2D decomposition images; no image analysis runs in the browser. */
export interface StructureBenchmark {
  schema: 'cssearth-structure-benchmark@1';
  title: string;
  source: { imagePath: string; name: string; widthPx: number; heightPx: number;
    description?: string; credit?: string; sourcePageUrl?: string };
  methods: { id: string; name: string; status: 'complete' | 'unavailable'; note?: string;
    panels: { id: string; name: string; imagePath: string; description?: string }[];
    metrics?: Record<string, number | string> }[];
  metadata?: { source?: string; crop?: string; limitations?: string[] };
}

export interface StructureBenchmarkCatalogueEntry { id: string; name: string; manifestPath: string; }
interface StructureBenchmarkCatalogue { schema: 'cssearth-structure-benchmark-catalogue@1'; benchmarks: StructureBenchmarkCatalogueEntry[]; }

function parseBenchmark(value: unknown): StructureBenchmark {
  const data = value as StructureBenchmark;
  const text = (item: unknown) => typeof item === 'string' && item.trim().length > 0;
  const optionalText = (item: unknown) => item === undefined || text(item);
  const imagePath = (item: unknown) => text(item) && !/^(?:[a-z]+:|\/)/i.test(item as string) &&
    !(item as string).split('/').some(segment => segment === '..') && !/[\\\u0000?#]/.test(item as string);
  if (!data || data.schema !== 'cssearth-structure-benchmark@1' || !text(data.title) ||
      !data.source || !text(data.source.name) || !imagePath(data.source.imagePath) ||
      !Number.isInteger(data.source.widthPx) || !Number.isInteger(data.source.heightPx) ||
      data.source.widthPx < 1 || data.source.heightPx < 1 || !optionalText(data.source.description) ||
      !optionalText(data.source.credit) || (data.source.sourcePageUrl !== undefined && !/^https:\/\//.test(data.source.sourcePageUrl)) ||
      !Array.isArray(data.methods) || !data.methods.length) throw new TypeError('Invalid prepared structure benchmark.');
  const ids = new Set<string>();
  for (const method of data.methods) {
    if (!method || !text(method.id) || ids.has(method.id) || !text(method.name) ||
        !['complete', 'unavailable'].includes(method.status) || !optionalText(method.note) || !Array.isArray(method.panels) ||
        (method.status === 'complete' && !method.panels.length) || (method.status === 'unavailable' && (!text(method.note) || method.panels.length))) {
      throw new TypeError('Each benchmark method needs prepared panels or an explanation of its unavailability.');
    }
    ids.add(method.id); const panelIds = new Set<string>();
    for (const panel of method.panels) {
      if (!panel || !text(panel.id) || panelIds.has(panel.id) || !text(panel.name) || !imagePath(panel.imagePath) || !optionalText(panel.description)) {
        throw new TypeError('Invalid prepared benchmark panel.');
      }
      panelIds.add(panel.id);
    }
    if (method.metrics !== undefined && (!method.metrics || typeof method.metrics !== 'object' || Array.isArray(method.metrics) ||
        Object.values(method.metrics).some(metric => typeof metric !== 'string' && (typeof metric !== 'number' || !Number.isFinite(metric))))) {
      throw new TypeError('Benchmark metrics must be prepared text or finite numbers.');
    }
  }
  if (data.metadata && (!optionalText(data.metadata.source) || !optionalText(data.metadata.crop) ||
      (data.metadata.limitations !== undefined && (!Array.isArray(data.metadata.limitations) || data.metadata.limitations.some(item => !text(item)))))) {
    throw new TypeError('Invalid benchmark source metadata.');
  }
  return data;
}

function parseCatalogue(value: unknown): StructureBenchmarkCatalogue {
  const data = value as StructureBenchmarkCatalogue;
  const text = (item: unknown) => typeof item === 'string' && item.trim().length > 0;
  const relativePath = (item: unknown) => text(item) && !/^(?:[a-z]+:|\/)/i.test(item as string) &&
    !(item as string).split('/').some(segment => segment === '..') && !/[\\\u0000?#]/.test(item as string);
  if (!data || data.schema !== 'cssearth-structure-benchmark-catalogue@1' || !Array.isArray(data.benchmarks) || !data.benchmarks.length) {
    throw new TypeError('Invalid prepared structure benchmark catalogue.');
  }
  const ids = new Set<string>();
  for (const benchmark of data.benchmarks) {
    if (!benchmark || !text(benchmark.id) || ids.has(benchmark.id) || !text(benchmark.name) || !relativePath(benchmark.manifestPath)) {
      throw new TypeError('Each benchmark catalogue entry needs a unique name and relative manifest path.');
    }
    ids.add(benchmark.id);
  }
  return data;
}

export function createBenchmarkView({ host, catalogueUrl, initialBenchmarkId }: {
  host: HTMLElement; catalogueUrl: string; initialBenchmarkId?: string | null;
}) {
  const document = host.ownerDocument;
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) => {
    const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;
  };
  const heading = element('h2', 'benchmark-title', 'Structure benchmark');
  const interpretation = element('p', 'benchmark-note', 'Prepared 2D morphology comparison. Classes are approximate image structure, not physical membership or measured 3D depth. Metrics use display units, not calibrated flux.');
  const status = element('p', 'benchmark-status'); status.setAttribute('role', 'status');
  const tools = element('div', 'benchmark-tools'); tools.hidden = true;
  const benchmarkLabel = element('label', undefined, 'Benchmark'), methodLabel = element('label', undefined, 'Method'), panelLabel = element('label', undefined, 'Panel');
  const benchmarkSelect = element('select'), methodSelect = element('select'), panelSelect = element('select');
  benchmarkSelect.id = 'benchmark-case'; methodSelect.id = 'benchmark-method'; panelSelect.id = 'benchmark-panel-choice';
  benchmarkLabel.htmlFor = benchmarkSelect.id; methodLabel.htmlFor = methodSelect.id; panelLabel.htmlFor = panelSelect.id;
  const benchmarkField = element('div'), methodField = element('div'), panelField = element('div');
  benchmarkField.append(benchmarkLabel, benchmarkSelect); methodField.append(methodLabel, methodSelect); panelField.append(panelLabel, panelSelect); tools.append(benchmarkField, methodField, panelField);
  const methodNote = element('p', 'benchmark-note');
  const pair = element('div', 'benchmark-pair'); pair.hidden = true;
  function figure() {
    const figure = element('figure', 'benchmark-figure'), caption = element('figcaption'), title = element('strong'), description = element('p');
    caption.append(title, description); const frame = element('div', 'benchmark-image-frame'), image = element('img');
    image.decoding = 'async'; frame.append(image); figure.append(frame, caption); return { figure, title, description, frame, image };
  }
  const source = figure(), result = figure(); source.image.id = 'benchmark-source-image'; result.image.id = 'benchmark-result-image'; pair.append(source.figure, result.figure);
  const metrics = element('table', 'benchmark-metrics'); metrics.hidden = true; metrics.append(element('caption', undefined, 'Prepared display-image measurements'));
  const metricBody = element('tbody'); metrics.append(metricBody);
  const metadata = element('div', 'benchmark-metadata'), sourceInfo = element('p'), cropInfo = element('p'), credit = element('p');
  const sourceLink = element('a', undefined, 'Source publication ↗'); sourceLink.target = '_blank'; sourceLink.rel = 'noreferrer'; sourceLink.hidden = true;
  const limitations = element('ul'); metadata.append(sourceInfo, cropInfo, credit, sourceLink, limitations);
  host.append(heading, interpretation, status, tools, methodNote, pair, metrics, metadata);
  const catalogueAbort = new AbortController();
  let catalogue: StructureBenchmarkCatalogue | null = null, data: StructureBenchmark | null = null, pending: Promise<void> | null = null;
  let manifestAbort: AbortController | null = null, manifestUrl = '', disposed = false, imageGeneration = 0;
  // Catalogue paths are repository-relative, while the lab serves local files through Vite's /@fs root.
  const cataloguePath = (path: string) => new URL(path, new URL('../../../../', new URL(catalogueUrl, location.href))).href;
  const url = (path: string) => new URL(path, new URL(manifestUrl, location.href)).href;
  const updateUrl = (id: string) => { const next = new URL(location.href); next.searchParams.set('benchmark', id); history.replaceState(history.state, '', next); };
  function showPanel() {
    if (!data || disposed) return;
    const method = data.methods.find(item => item.id === methodSelect.value)!; const panel = method.panels.find(item => item.id === panelSelect.value);
    const generation = ++imageGeneration; result.image.onload = result.image.onerror = null; result.figure.hidden = !panel; delete host.dataset.error; delete host.dataset.ready;
    if (!panel) { status.textContent = 'Method unavailable.'; host.dataset.ready = 'true'; return; }
    result.title.textContent = panel.name; result.description.textContent = panel.description ?? ''; result.image.alt = `${method.name}: ${panel.name}`; result.image.hidden = true; status.textContent = 'Loading prepared comparison…';
    result.image.onload = () => {
      if (disposed || generation !== imageGeneration || !data) return;
      if (result.image.naturalWidth !== data.source.widthPx || result.image.naturalHeight !== data.source.heightPx) { status.textContent = 'This panel does not match the prepared source extent.'; host.dataset.error = 'true'; return; }
      result.image.hidden = false; status.textContent = 'Matched image extent and display scale.'; host.dataset.ready = 'true';
    };
    result.image.onerror = () => { if (!disposed && generation === imageGeneration) { status.textContent = 'The prepared comparison image could not be loaded.'; host.dataset.error = 'true'; } };
    result.image.src = url(panel.imagePath);
  }
  function showMethod() {
    if (!data || disposed) return;
    const method = data.methods.find(item => item.id === methodSelect.value)!; host.dataset.method = method.id; host.dataset.methodStatus = method.status; methodNote.textContent = method.note ?? '';
    const previousPanel = panelSelect.value; panelSelect.replaceChildren(...method.panels.map(panel => { const option = element('option', undefined, panel.name); option.value = panel.id; return option; }));
    if (method.panels.some(panel => panel.id === previousPanel)) panelSelect.value = previousPanel; panelField.hidden = method.status === 'unavailable';
    metricBody.replaceChildren(...Object.entries(method.metrics ?? {}).map(([name, value]) => { const row = element('tr'), label = element('th', undefined, name), metric = element('td', undefined, String(value)); label.scope = 'row'; row.append(label, metric); return row; }));
    metrics.hidden = !metricBody.children.length; showPanel();
  }
  async function loadManifest(id: string, preferredMethodId?: string, preferredPanelId?: string) {
    if (!catalogue || disposed) return;
    const entry = catalogue.benchmarks.find(item => item.id === id); if (!entry) throw new TypeError(`Unknown structure benchmark: ${id}`);
    manifestAbort?.abort(); const controller = manifestAbort = new AbortController(); const generation = ++imageGeneration;
    data = null; manifestUrl = cataloguePath(entry.manifestPath); host.dataset.benchmark = entry.id; host.dataset.ready = 'false'; delete host.dataset.error;
    pair.hidden = true; metrics.hidden = true; methodSelect.replaceChildren(); panelSelect.replaceChildren(); result.image.onload = result.image.onerror = null; result.image.hidden = true; status.textContent = `Loading ${entry.name}…`;
    const response = await fetch(manifestUrl, { signal: controller.signal }); if (!response.ok) throw new Error(`Prepared benchmark is unavailable (HTTP ${response.status}).`);
    const parsed = parseBenchmark(await response.json()); if (disposed || controller.signal.aborted || generation !== imageGeneration) return;
    data = parsed; heading.textContent = data.title; source.title.textContent = data.source.name; source.description.textContent = data.source.description ?? ''; source.image.alt = data.source.name;
    source.frame.style.aspectRatio = result.frame.style.aspectRatio = `${data.source.widthPx} / ${data.source.heightPx}`; source.image.src = url(data.source.imagePath); await source.image.decode();
    if (disposed || controller.signal.aborted || generation !== imageGeneration) return;
    if (source.image.naturalWidth !== data.source.widthPx || source.image.naturalHeight !== data.source.heightPx) throw new Error('The source image does not match its prepared dimensions.');
    methodSelect.replaceChildren(...data.methods.map(method => { const option = element('option', undefined, method.name + (method.status === 'unavailable' ? ' · unavailable' : '')); option.value = method.id; return option; }));
    methodSelect.value = data.methods.some(method => method.id === preferredMethodId) ? preferredMethodId! : data.methods.find(method => method.status === 'complete')?.id ?? data.methods[0]!.id;
    sourceInfo.textContent = data.metadata?.source ?? ''; cropInfo.textContent = data.metadata?.crop ?? ''; credit.textContent = data.source.credit ?? ''; sourceLink.hidden = !data.source.sourcePageUrl;
    if (data.source.sourcePageUrl) sourceLink.href = data.source.sourcePageUrl; limitations.replaceChildren(...(data.metadata?.limitations ?? []).map(note => element('li', undefined, note)));
    tools.hidden = pair.hidden = false; showMethod();
    if (preferredPanelId && Array.from(panelSelect.options).some(option => option.value === preferredPanelId)) { panelSelect.value = preferredPanelId; showPanel(); }
  }
  methodSelect.addEventListener('change', showMethod); panelSelect.addEventListener('change', showPanel);
  const onBenchmarkChange = () => {
    if (!catalogue || disposed) return;
    const previousMethod = methodSelect.value, previousPanel = panelSelect.value; updateUrl(benchmarkSelect.value);
    void loadManifest(benchmarkSelect.value, previousMethod, previousPanel).catch(error => { if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return; status.textContent = error instanceof Error ? error.message : String(error); host.dataset.error = 'true'; });
  };
  benchmarkSelect.addEventListener('change', onBenchmarkChange);
  async function load() {
    status.textContent = 'Loading prepared structure benchmark catalogue…';
    try {
      const response = await fetch(catalogueUrl, { signal: catalogueAbort.signal }); if (!response.ok) throw new Error(`Prepared benchmark catalogue is unavailable (HTTP ${response.status}).`);
      catalogue = parseCatalogue(await response.json()); if (disposed) return;
      benchmarkSelect.replaceChildren(...catalogue.benchmarks.map(benchmark => { const option = element('option', undefined, benchmark.name); option.value = benchmark.id; return option; }));
      const requested = new URL(location.href).searchParams.get('benchmark') ?? initialBenchmarkId; const selected = catalogue.benchmarks.find(benchmark => benchmark.id === requested) ?? catalogue.benchmarks[0]!;
      benchmarkSelect.value = selected.id; updateUrl(selected.id); await loadManifest(selected.id);
    } catch (error) {
      if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return;
      status.textContent = error instanceof Error ? error.message : String(error); host.dataset.error = 'true';
    }
  }
  return {
    open() { if (!pending && !disposed) pending = load(); return pending ?? Promise.resolve(); },
    destroy() { disposed = true; catalogueAbort.abort(); manifestAbort?.abort(); methodSelect.removeEventListener('change', showMethod); panelSelect.removeEventListener('change', showPanel); benchmarkSelect.removeEventListener('change', onBenchmarkChange); result.image.onload = result.image.onerror = null; },
  };
}
