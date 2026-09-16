import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Attribution belongs to the currently inspected image, never to the processing controls. */
export function ImageCredit({ credit, active = true }: { credit?: string; active?: boolean }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  return host && active && credit?.trim() ? createPortal(
    <p className="workspace-image-credit" aria-label="Image credit" title={credit.trim()}>{credit.trim()}</p>, host,
  ) : null;
}
