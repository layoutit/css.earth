/** Align only visible charts. Hidden content owns no measurement frame, and
 * reading all positions before publishing avoids per-chart layout flushes. */
export function createChartPixelAlignmentController(drawer, windowTarget) {
  const charts = [...drawer.querySelectorAll('.planet-chart')];
  if (!charts.length) return { destroy() {} };
  const visible = new Set(), offsets = new Map(), events = new AbortController();
  let frame = null, disposed = false;
  const cancel = () => {
    if (frame !== null) windowTarget.cancelAnimationFrame(frame);
    frame = null;
  };
  const align = () => {
    frame = null;
    if (disposed) return;
    const density = Math.max(1, windowTarget.devicePixelRatio || 1);
    const positions = [...visible].map(chart => {
      const top = chart.getBoundingClientRect().top - (offsets.get(chart) ?? 0);
      return { chart, offset: Math.round(top * density) / density - top };
    });
    for (const { chart, offset } of positions) {
      if (offset === (offsets.get(chart) ?? 0)) continue;
      offsets.set(chart, offset);
      chart.style.setProperty('translate', `0 ${offset}px`);
    }
  };
  const schedule = () => {
    if (!disposed && visible.size && frame === null) frame = windowTarget.requestAnimationFrame(align);
  };
  const observer = new windowTarget.IntersectionObserver(entries => {
    if (disposed) return;
    for (const entry of entries) {
      if (entry.isIntersecting && entry.boundingClientRect.width > 0 && entry.boundingClientRect.height > 0) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    if (visible.size) schedule(); else cancel();
  });
  for (const chart of charts) {
    observer.observe(chart);
    chart.addEventListener('load', schedule, { signal: events.signal });
  }
  for (const switcher of drawer.querySelectorAll('.planet-chart-switcher')) switcher.addEventListener('chartchange', schedule, { signal: events.signal });
  windowTarget.addEventListener('resize', schedule, { signal: events.signal });
  return {
    destroy() {
      if (disposed) return;
      disposed = true; events.abort(); observer.disconnect(); cancel(); visible.clear();
      for (const chart of offsets.keys()) chart.style.removeProperty('translate');
      offsets.clear();
    },
  };
}
