/** Reads the size of a caption's text when the page's layout is already computed.
 *
 * A caption's name is the `::after` of a zero-size element, so nothing but its computed style tells its width. Read
 * inside a frame's publication, that style forces a style and layout pass over everything the frame has written so far,
 * which the browser then repeats for the rest: on an iPad the read was 3.8 % of the script time of a zoom out of Earth
 * (2026-10-04). An intersection observer reports a newly observed element after the next layout, in a task of its own,
 * and the read there finds the layout clean. */
export interface CaptionMeasurer<Entry> {
  /** Ask for `entry`'s caption size; `measured` hears it after the next layout. A pending request is not repeated. */
  request(entry: Entry): void;
  /** Whether `entry`'s caption still waits for its report: its marker has to stay on the page until then. */
  pending(entry: Entry): boolean;
  destroy(): void;
}

export function createCaptionMeasurer<Entry extends { readonly caption: Element }>(windowTarget: Window & typeof globalThis, { hold, measured, done }: {
  /** While true (the camera coasts) a report is dropped: the next publication asks again. */
  hold(): boolean;
  measured(entry: Entry, size: { readonly width: number; readonly height: number }): void;
  /** Called once after a report that measured at least one caption. */
  done(): void;
}): CaptionMeasurer<Entry> | null {
  // A page without the observer (a server or test document) measures in the publication, as before.
  if (typeof windowTarget.IntersectionObserver !== 'function') return null;
  const pending = new Map<Element, Entry>();
  const observer = new windowTarget.IntersectionObserver(records => {
    let any = false;
    for (const record of records) {
      const entry = pending.get(record.target);
      if (!entry) continue;
      pending.delete(record.target);
      observer.unobserve(record.target);
      if (hold() || !record.target.isConnected) continue;
      const text = windowTarget.getComputedStyle(record.target, '::after');
      const width = Math.ceil(parseFloat(text.width)), height = Math.ceil(parseFloat(text.height));
      if (width > 0 && height > 0) { measured(entry, { width, height }); any = true; }
    }
    if (any) done();
  });
  return {
    request(entry) {
      if (pending.has(entry.caption)) return;
      pending.set(entry.caption, entry);
      observer.observe(entry.caption);
    },
    pending: entry => pending.has(entry.caption),
    destroy() { pending.clear(); observer.disconnect(); },
  };
}
