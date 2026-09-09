/** Catalogue focus on the current detailed scene's shared camera owner. */
export function createPreparedContextNavigation({ layer, presentation, sources = [], windowTarget, onError = console.error }) {
  let navigation = null, unsubscribe = null, unsubscribeLens = null, lensObjectId = null, ready = false, flight = null, selected = null;
  let notify = () => {}, beforeFlight = () => {}, notifyContent = () => {};
  const lensState = id => {
    const objectId = id ? layer.resolveGalaxy(id)?.detailedObjectId : null;
    return objectId ? layer.volumeLensState?.(objectId) ?? null : null;
  };
  const writeSelectionUrl = id => {
    const url = new URL(windowTarget.location.href), state = lensState(id);
    if (id) url.searchParams.set('focus', id); else url.searchParams.delete('focus');
    if (state) url.searchParams.set('focusLens', state.selectedLens); else url.searchParams.delete('focusLens');
    if (url.href === windowTarget.location.href) return;
    windowTarget.history.replaceState(windowTarget.history.state, '', url.pathname + url.search + url.hash);
    notify(url.href);
  };
  const publishContent = id => {
    const record = id ? layer.resolveGalaxy(id) : null;
    const references = record ? [record.skyPosition.sourceRef, record.distance.sourceRef, record.membership?.sourceRef, record.classification?.sourceRef].filter(Boolean) : [];
    const state = lensState(id);
    const canSelect = () => ready && navigation?.preparedFocus?.()?.id === id && selected === id;
    const controls = state ? { ...state,
      selectLens(lensId) {
        if (!canSelect()) return;
        layer.selectVolumeLens(state.objectId, lensId);
        if (!unsubscribeLens) publishLens();
      },
      ...(layer.setVolumeStarsVisible ? { setStarsVisible(enabled) {
        if (!canSelect()) return;
        layer.setVolumeStarsVisible(state.objectId, enabled);
        if (!unsubscribeLens) publishLens();
      } } : {}),
    } : null;
    notifyContent(record, sources.filter(source => references.some(reference => reference === source.id || reference.startsWith(`${source.id}:`))), controls);
  };
  const publishLens = () => {
    if (!ready || !selected) return;
    publishContent(selected);
    writeSelectionUrl(selected);
  };
  const observeLens = id => {
    const objectId = lensState(id)?.objectId ?? null;
    if (objectId === lensObjectId) return;
    unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = objectId;
    if (objectId) unsubscribeLens = layer.subscribeVolumeLens?.(objectId, publishLens) ?? null;
  };
  const resolve = id => {
    const object = layer.resolveGalaxy(id);
    if (!object) throw new TypeError(`Unknown prepared galaxy focus: ${id}`);
    const volume = object.detailedObjectId ? layer.volumeLensFrames?.[object.detailedObjectId] : null;
    const frame = volume?.frame ?? (object.detailedObjectId ? layer.imageLayerFrames?.[object.detailedObjectId] : null);
    const radius = object.presentation?.focusRadiusM ?? (volume ? volume.framingRadiusUnits * frame.metersPerUnit : frame
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
    selected = next; observeLens(next);
    publishContent(next);
    writeSelectionUrl(next);
  };
  return Object.freeze({
    connect(owner, { onFocusChange = () => {}, onFlightStart = () => {}, onFocusContentChange = () => {} } = {}) {
      unsubscribe?.(); unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = null; flight?.abort();
      navigation = owner; ready = false; notify = onFocusChange; beforeFlight = onFlightStart; notifyContent = onFocusContentChange;
      unsubscribe = owner.subscribe(publishSelection);
      return () => {
        if (navigation !== owner) return;
        unsubscribe?.(); unsubscribe = null; unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = null;
        flight?.abort(); navigation = null; ready = false;
      };
    },
    suspend() { ready = false; flight?.abort(); },
    restore(url) {
      if (!navigation?.setPreparedFocus) return;
      ready = false;
      const query = new URL(url, windowTarget.location.href).searchParams;
      try {
        if (query.getAll('focus').length > 1) throw new TypeError('A saved view may have only one prepared focus.');
        if (query.getAll('focusLens').length > 1) throw new TypeError('A saved view may have only one prepared focus lens.');
        const id = query.get('focus'), focus = id ? resolve(id) : null, state = lensState(id);
        const lensId = query.get('focusLens') ?? state?.defaultLens;
        if (id && lensId !== undefined && (!state || !state.lenses.some(lens => lens.id === lensId))) {
          throw new TypeError(`Unknown prepared focus lens: ${lensId}`);
        }
        navigation.setPreparedFocus(focus);
        if (state && lensId !== undefined) layer.selectVolumeLens(state.objectId, lensId);
        selected = id; layer.selectGalaxy(id); observeLens(id);
        publishContent(id);
        if (!id || (state && !query.has('focusLens'))) writeSelectionUrl(id);
      } catch (error) {
        selected = navigation.preparedFocus?.()?.id ?? null;
        layer.selectGalaxy(selected); observeLens(selected);
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
    destroy() { flight?.abort(); unsubscribe?.(); unsubscribeLens?.(); unsubscribeLens = null; lensObjectId = null; navigation = null; ready = false; },
  });
}
