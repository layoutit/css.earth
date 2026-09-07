/** Catalogue focus on the current detailed scene's shared camera owner. */
export function createPreparedContextNavigation({ layer, presentation, sources = [], windowTarget, onError = console.error }) {
  let navigation = null, unsubscribe = null, ready = false, flight = null, selected = null;
  let notify = () => {}, beforeFlight = () => {}, notifyContent = () => {};
  const publishContent = id => {
    const record = id ? layer.resolveGalaxy(id) : null;
    const references = record ? [record.skyPosition.sourceRef, record.distance.sourceRef, record.membership?.sourceRef, record.classification?.sourceRef].filter(Boolean) : [];
    notifyContent(record, sources.filter(source => references.some(reference => reference === source.id || reference.startsWith(`${source.id}:`))));
  };
  const resolve = id => {
    const object = layer.resolveGalaxy(id);
    if (!object) throw new TypeError(`Unknown prepared galaxy focus: ${id}`);
    const frame = object.detailedObjectId ? layer.imageLayerFrames[object.detailedObjectId] : null;
    const radius = object.presentation?.focusRadiusM ?? (frame
      ? Math.max(...frame.boundsUnits.max.map((value, axis) => Math.abs(value - frame.boundsUnits.min[axis]) / 2)) * frame.metersPerUnit
      : (object.halfLightRadius ? object.halfLightRadius.valuePc * presentation.metersPerParsec * 3 : presentation.defaultFocusRadiusM));
    return { id, positionM: object.positionM, framingRadiusM: radius,
      limits: { minimumDistanceM: radius * presentation.minimumDistanceRadii, maximumDistanceM: presentation.maximumDistanceM } };
  };
  const publishSelection = () => {
    if (!ready || !navigation) return;
    const next = navigation.preparedFocus?.()?.id ?? null;
    layer.selectGalaxy(next);
    if (next === selected) return;
    selected = next;
    publishContent(next);
    const url = new URL(windowTarget.location.href);
    if (next) url.searchParams.set('focus', next); else url.searchParams.delete('focus');
    windowTarget.history.replaceState(windowTarget.history.state, '', url.pathname + url.search + url.hash);
    notify(url.href);
  };
  return Object.freeze({
    connect(owner, { onFocusChange = () => {}, onFlightStart = () => {}, onFocusContentChange = () => {} } = {}) {
      unsubscribe?.(); flight?.abort();
      navigation = owner; ready = false; notify = onFocusChange; beforeFlight = onFlightStart; notifyContent = onFocusContentChange;
      unsubscribe = owner.subscribe(publishSelection);
      return () => {
        if (navigation !== owner) return;
        unsubscribe?.(); unsubscribe = null; flight?.abort(); navigation = null; ready = false;
      };
    },
    suspend() { ready = false; flight?.abort(); },
    restore(url) {
      if (!navigation?.setPreparedFocus) return;
      ready = false;
      const query = new URL(url, windowTarget.location.href).searchParams;
      try {
        if (query.getAll('focus').length > 1) throw new TypeError('A saved view may have only one prepared focus.');
        const id = query.get('focus');
        navigation.setPreparedFocus(id ? resolve(id) : null);
        selected = id; layer.selectGalaxy(id);
        publishContent(id);
      } catch (error) {
        selected = navigation.preparedFocus?.()?.id ?? null;
        layer.selectGalaxy(selected);
        publishContent(selected);
        onError(error);
      }
      finally { ready = true; }
    },
    async select(object) {
      if (!navigation?.flyToPreparedFocus) return;
      flight?.abort(); const controller = new AbortController(); flight = controller;
      try {
        const focus = resolve(object.id);
        beforeFlight();
        ready = true;
        await navigation.flyToPreparedFocus(focus, { signal: controller.signal,
          reducedMotion: windowTarget.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true });
        publishSelection();
      } catch (error) { if (error?.name !== 'AbortError') onError(error); }
      finally { if (flight === controller) flight = null; }
    },
    destroy() { flight?.abort(); unsubscribe?.(); navigation = null; ready = false; },
  });
}
