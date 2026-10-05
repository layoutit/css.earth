/** Ordered port of the lab DOM-write classification, installed before application scripts. */
export const ALLOWED = [
  / \{ (transform|opacity) \}( removed)?$/u,
  / \[points\]$/u, / \{ stroke-opacity \}$/u, / <\+polyline>$/u, // orbit strokes; a dot bank's dimming is its stroke opacity too
  / \[d\]$/u, // batched star points: one SVG path per color
  /^div\.object-input-surface \{ cursor \}$/u, // the release itself sets the grab cursor, once
];
export const CLASSIFICATION_HELPERS = `  const describe = element => {
    let text = element.localName;
    if (element.id) text += '#' + element.id;
    for (const name of [...element.classList].slice(0, 3)) text += '.' + name;
    for (const attribute of element.attributes) if (attribute.name.startsWith('data-') && text.length < 120) text += '[' + attribute.name + ']';
    return text;
  };
  const parse = text => { const map = new Map(); for (const part of (text || '').split(';')) { const i = part.indexOf(':'); if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim()); } return map; };
`;
export const PROBE = `(() => {
  const dom = [], errors = [], workers = new Map(), workerReplies = [], releasedReplies = new WeakSet();
  const workerEvidence = [];
  let nativeWorkerMessages = 0;
  let workerSerial = 0, coastCompleted = false, coastStarted = false;
  let flushMotion = () => {};
  let announced = false, coasting = false, wheelUntil = 0, mutations = 0, messages = 0, imageJobs = 0;
  const idleCallbacks = new Map(); let idleSerial = 0;
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback = (callback, options = {}) => { const id = ++idleSerial; idleCallbacks.set(id, { callback, deadline: performance.now() + (options.timeout ?? Infinity) }); return id; };
    window.cancelIdleCallback = id => { idleCallbacks.delete(id); };
  }
  const nativeDecode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function(...args) {
    imageJobs++;
    try { return Reflect.apply(nativeDecode, this, args).finally(() => { imageJobs--; }); }
    catch (error) { imageJobs--; throw error; }
  };
  const moving = () => announced || performance.now() < wheelUntil;
  const onMotion = event => { announced = Boolean(event.detail && event.detail.active); if (event.type === 'objectmotionchange') coasting = Boolean(event.detail && event.detail.coasting); };
  const onWheel = () => { wheelUntil = performance.now() + 700; };
  for (const type of ['objectrotationchange', 'objectmotionchange']) document.addEventListener(type, event => { flushMotion(); onMotion(event); if (event.type === 'objectmotionchange') { if (coasting) { coastStarted = true; coastCompleted = false; } if (coastStarted && !announced && !coasting) coastCompleted = true; } }, true);
  addEventListener('wheel', onWheel, { capture: true, passive: true });
  ${CLASSIFICATION_HELPERS}
  const scriptText = new WeakSet(), parserText = new Map();
  const markText = node => { scriptText.add(node); for (const child of node.childNodes || []) scriptText.add(child); };
  for (const [prototype, name] of [[Node.prototype, 'textContent'], [Node.prototype, 'nodeValue'], [CharacterData.prototype, 'data']]) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (!descriptor || !descriptor.set) continue;
    Object.defineProperty(prototype, name, { ...descriptor, set(value) { markText(this); Reflect.apply(descriptor.set, this, [value]); markText(this); } });
  }
  for (const name of ['appendData', 'deleteData', 'insertData', 'replaceData']) {
    const original = CharacterData.prototype[name];
    CharacterData.prototype[name] = function(...args) { markText(this); return Reflect.apply(original, this, args); };
  }
  for (const name of ['createElement', 'createElementNS', 'createTextNode']) {
    const original = Document.prototype[name];
    Document.prototype[name] = function(...args) { const node = Reflect.apply(original, this, args); scriptText.add(node); return node; };
  }
  const rawText = node => node.nodeType === 3 && node.parentElement && ['style', 'script', 'noscript'].includes(node.parentElement.localName)
    && !scriptText.has(node) && !scriptText.has(node.parentElement);
  const subjects = new WeakMap(), counters = new Map();
  const path = node => {
    if (subjects.has(node)) return subjects.get(node);
    const element = node instanceof Element ? node : node.parentElement;
    const parent = node.parentElement;
    const owner = parent ? path(parent) : 'document';
    const identity = node instanceof Element ? node.localName + (node.id ? '#' + node.id : '')
      + '.' + [...node.classList].sort().join('.') + JSON.stringify([...node.attributes]
        .filter(attribute => attribute.name.startsWith('data-') || ['role', 'name', 'type', 'aria-label'].includes(attribute.name))
        .map(attribute => [attribute.name, attribute.value]).sort((a,b) => a[0].localeCompare(b[0]))) : node.nodeName;
    const key = owner + '>' + identity, counter = counters.get(key) || 0;
    counters.set(key, counter + 1); const subject = key + '@' + counter;
    subjects.set(node, subject); return subject;
  };
  const remember = node => { path(node); for (const child of node.childNodes) remember(child); };
  const allowed = [${ALLOWED.map(pattern => pattern.toString()).join(',')}];
  const bump = (key, value, target, before = null) => dom.push({ key, value, before, subject: path(target), frame: Math.floor(performance.now() / 16), moving: moving(), coasting,
    classification: (allowed.some(pattern => pattern.test(key)) ? 'ALLOWED' : 'OFF-PATH') + (coasting ? '/COASTING' : '/REST') });
  const ours = node => node.nodeType === 1 ? Boolean(node.closest('[data-capture-overlay]')) : Boolean(node.parentElement && node.parentElement.closest('[data-capture-overlay]'));
  const observe = records => {
    mutations += records.length;
    for (let index = 0; index < records.length; index++) {
      const record = records[index], element = record.target;
      if (ours(element)) continue;
      const who = describe(element.nodeType === 1 ? element : element.parentElement || document.documentElement);
      if (record.type === 'childList') {
        for (const node of record.addedNodes) if (!ours(node)) { remember(node); if (rawText(node)) parserText.set(path(node), node); bump(who + ' <+' + (node.localName || '#text') + '>', path(element), node); }
        for (const node of record.removedNodes) bump(who + ' <-' + (node.localName || '#text') + '>', path(element), node);
        continue;
      }
      if (record.type === 'characterData') {
        const next = records.slice(index + 1).find(row => row.target === element && row.type === 'characterData');
        bump(who + ' [text]', next ? next.oldValue : element.textContent, element, record.oldValue);
        if (rawText(element)) { parserText.set(path(element), element); dom[dom.length - 1].volatile = 'html-parser-text-chunks'; }
        continue;
      }
      const name = record.attributeName;
      // Reconstruct each write from the next record's oldValue, instead of losing intermediate values in a batch.
      const next = records.slice(index + 1).find(row => row.target === element && row.attributeName === name);
      const value = next ? next.oldValue : element.getAttribute(name);
      if (name === 'style') {
        const before = parse(record.oldValue), after = parse(value);
        let changed = false;
        for (const [property, value] of after) if (before.get(property) !== value) { changed = true; bump(who + ' { ' + property + ' }', value, element, before.get(property) ?? null); }
        for (const property of before.keys()) if (!after.has(property)) { changed = true; bump(who + ' { ' + property + ' } removed', '', element, before.get(property)); }
        if (!changed) bump(who + ' { same value }', '', element);
      } else if (record.oldValue === value) bump(who + ' [' + name + '] same value', record.oldValue, element, record.oldValue);
      else bump(who + ' [' + name + ']', value, element, record.oldValue);
    }
  };
  const observer = new MutationObserver(observe);
  flushMotion = () => observe(observer.takeRecords());
  observer.observe(document, { subtree: true, attributes: true, attributeOldValue: true, childList: true, characterData: true, characterDataOldValue: true });
  addEventListener('unhandledrejection', event => errors.push({ source: 'unhandledrejection', message: String(event.reason) }));
  const NativeWorker = window.Worker;
  if (NativeWorker) window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args); const jobs = new Set(), serial = ++workerSerial; workers.set(this, jobs);
      const evidence = { url: new URL(String(args[0]), document.baseURI).href, serial, nativeReplies: 0, jobs }; workerEvidence.push(evidence);
      this.addEventListener('message', event => {
        if (event.isTrusted) { nativeWorkerMessages++; evidence.nativeReplies++; }
        if (!window.__journeyScheduleWorkers || releasedReplies.has(event)) return;
        event.stopImmediatePropagation();
        if (event.data && typeof event.data.id === 'number') jobs.delete(event.data.id);
        if (event.data && event.data.ready === true) jobs.delete('initialise');
        if (event.data && typeof event.data.error === 'string') jobs.clear();
        workerReplies.push({ worker: this, serial, event });
      });
      this.addEventListener('message', event => { messages++; if (event.data && typeof event.data.id === 'number') jobs.delete(event.data.id); if (event.data && event.data.ready === true) jobs.delete('initialise'); if (event.data && typeof event.data.error === 'string') { jobs.clear(); errors.push({ source: 'worker-protocol-error', message: event.data.error }); } });
      this.addEventListener('error', event => { jobs.clear(); errors.push({ source: 'worker-error', message: event.message }); });
      this.addEventListener('messageerror', () => { jobs.clear(); errors.push({ source: 'worker-messageerror', message: 'Worker response decode failed' }); });
    }
    postMessage(...args) { const data = args[0]; if (data && typeof data.id === 'number') workers.get(this).add(data.id); else if (data && data.validatedPlan) workers.get(this).add('initialise'); try { return super.postMessage(...args); } catch (error) { if (data) workers.get(this).delete(data.id ?? 'initialise'); throw error; } }
    terminate() { const jobs = workers.get(this); if (jobs) jobs.clear(); workers.delete(this); return super.terminate(); }
  };
  const decodedImages = new Map();
  // Observe only already-requested document images. Creating background/lazy Images changes app traffic.
  const decodeOnce = image => {
    const url = image.currentSrc || image.src;
    if (!image.complete || !image.naturalWidth || !url) return Promise.resolve();
    if (!decodedImages.has(url)) decodedImages.set(url, image.decode());
    return decodedImages.get(url);
  };
  window.__journey = { subject: path,
    releaseWorkers() {
      const replies = workerReplies.splice(0).sort((a, b) => a.serial - b.serial || (a.event.data?.id ?? -1) - (b.event.data?.id ?? -1));
      for (const { worker, event } of replies) {
        if (!workers.has(worker)) continue;
        const released = new MessageEvent('message', { data: event.data, origin: event.origin, lastEventId: event.lastEventId, ports: event.ports });
        releasedReplies.add(released); worker.dispatchEvent(released);
      }
      return replies.length;
    },
    releaseIdle() {
      if (imageJobs || [...workers.values()].some(jobs => jobs.size)) return;
      const callbacks = [...idleCallbacks]; idleCallbacks.clear();
      for (const [, entry] of callbacks) entry.callback({ didTimeout: performance.now() >= entry.deadline, timeRemaining: () => 16 });
    },
    async decode() {
      await document.fonts.ready;
      const pending = [...document.images].map(decodeOnce);
      await Promise.all(pending);
    }, drain() { observe(observer.takeRecords()); return { dom: dom.splice(0).map(row => parserText.has(row.subject) ? { ...row, parserFinalText: parserText.get(row.subject).textContent } : row), errors: errors.splice(0) }; },
    status() { observe(observer.takeRecords()); return { mutations, messages, replies: workerReplies.length, idle: idleCallbacks.size, moving: moving(), coastCompleted, nativeWorkerMessages, workerEvidence: workerEvidence.map(entry => ({ url: entry.url, nativeReplies: entry.nativeReplies, jobs: entry.jobs.size, replies: workerReplies.filter(reply => reply.serial === entry.serial).length })), jobs: imageJobs + [...workers.values()].reduce((sum, jobs) => sum + jobs.size, 0) }; } };
})()`;
