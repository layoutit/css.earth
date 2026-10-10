import { useEffect, useState } from 'react';
/** How long the shared viewer took to show its last prepared bank: from its load starting (`data-ready` false) to the
 * bank decoded and mounted (`data-ready` true). The viewer writes both; this only watches. */
export function useViewerOpenTime(): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const viewer = document.getElementById('viewer'); if (!viewer) return;
    let started: number | null = viewer.dataset.ready === 'false' ? performance.now() : null;
    const observer = new MutationObserver(() => {
      if (viewer.dataset.ready === 'false' && started === null) started = performance.now();
      else if (viewer.dataset.ready === 'true' && started !== null) {
        const value = (performance.now() - started) / 1000; started = null; setSeconds(value);
        viewer.dataset.openSeconds = value.toFixed(3);
      }
    });
    observer.observe(viewer, { attributes: true, attributeFilter: ['data-ready'] });
    return () => observer.disconnect();
  }, []);
  return seconds;
}
