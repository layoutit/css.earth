/** Serialized into the visible page. Store JSON values only: diagnostics must not
 * themselves keep retired DOM nodes, images, controllers or remote objects alive. */
function installResidencyProbe() {
  const key = '__cssEarthCaptureResidency';
  const previous: unknown = Reflect.get(window, key);
  if (previous && typeof previous === 'object' && 'stop' in previous && typeof previous.stop === 'function') previous.stop();
  const released: unknown[] = [];
  let dropped = 0;
  const releasedScene = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    if (released.length >= 256) { released.shift(); dropped++; }
    released.push(JSON.parse(JSON.stringify(event.detail)));
  };
  const call = (owner: unknown, method: string): unknown => {
    if (!owner || typeof owner !== 'object') return null;
    const member: unknown = Reflect.get(owner, method);
    return typeof member === 'function' ? Reflect.apply(member, owner, []) : null;
  };
  const read = () => {
    const stage = document.querySelector<HTMLElement>('.object-stage'), objectId = stage?.dataset.objectId ?? null;
    const diagnostic: unknown = objectId ? Reflect.get(window, `__${objectId}`) : null;
    const runtime: unknown = diagnostic && typeof diagnostic === 'object' ? Reflect.get(diagnostic, 'runtime') : null;
    const svg = document.querySelector('.context-orbit-strokes');
    const groups = [...(svg?.querySelectorAll<SVGElement>('g[data-context-orbit]') ?? [])];
    const lines = [...(svg?.querySelectorAll('polyline') ?? [])];
    const painted = groups.filter(group => group.querySelector('polyline[points]'));
    const billboard = document.querySelector<HTMLImageElement>('img[data-arrival-billboard]');
    return { atEpochMs: performance.timeOrigin + performance.now(), url: location.href, objectId, visibility: document.visibilityState,
      scene: { ready: document.body.classList.contains('ready'), lifetime: call(runtime, 'lifetime'),
        resources: call(runtime, 'resources'), presentation: call(runtime, 'presentation') },
      dom: { elements: document.querySelectorAll('*').length, stages: document.querySelectorAll('.object-stage').length,
        sceneElements: stage?.querySelectorAll('*').length ?? 0 },
      orbits: { svgs: document.querySelectorAll('.context-orbit-strokes').length, groups: groups.length,
        hosts: document.querySelectorAll('div.context-orbit').length,
        shownGroups: groups.filter(group => group.style.display !== 'none').length,
        retainedPolylines: lines.length, populatedPolylines: lines.filter(line => line.hasAttribute('points')).length,
        pointCharacters: lines.reduce((sum, line) => sum + (line.getAttribute('points')?.length ?? 0), 0),
        // Keep exact paint values so equal geometry with changing brightness can
        // be separated from accumulating strokes or browser raster artifacts.
        paint: painted.slice(0, 128).map(group => ({ id: group.dataset.contextOrbit,
          selected: group.dataset.contextSelected, opacity: getComputedStyle(group).opacity,
          strokes: [...group.querySelectorAll('polyline[points]')].map(line => {
            const css = getComputedStyle(line);
            return { points: line.getAttribute('points'), stroke: css.stroke, strokeOpacity: css.strokeOpacity,
              opacity: css.opacity, width: css.strokeWidth };
          }) })), omittedPaintGroups: Math.max(0, painted.length - 128) },
      fragments: call(Reflect.get(window, Symbol.for('cssearth.navigation-fragments')), 'inspect'),
      billboard: billboard ? { phase: billboard.dataset.arrivalBillboard, complete: billboard.complete,
        width: billboard.naturalWidth, height: billboard.naturalHeight, url: billboard.currentSrc } : null,
    };
  };
  window.addEventListener('cssearthscenereleased', releasedScene);
  const stop = () => {
    window.removeEventListener('cssearthscenereleased', releasedScene);
    Reflect.deleteProperty(window, key);
    return { released, dropped };
  };
  Reflect.set(window, key, { read, stop });
  return read();
}

export const INSTALL_RESIDENCY_PROBE = `(${installResidencyProbe.toString()})()`;
export const READ_RESIDENCY_PROBE = 'window.__cssEarthCaptureResidency?.read() ?? null';
export const STOP_RESIDENCY_PROBE = 'window.__cssEarthCaptureResidency?.stop() ?? null';
