import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A stable top-of-rail slot keeps image selection ahead of method navigation. */
export function WorkspaceImagePicker({ children, target = 'inference-image-picker' }: { children: ReactNode; target?: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Shell capabilities arrive asynchronously and may replace the destination node.
    // The processing controls live in a separate React root, so they do not remount with it.
    const resolveHost = () => {
      const next = document.getElementById(target);
      setHost(current => current === next ? current : next);
    };
    const observer = new MutationObserver(resolveHost);
    observer.observe(document.body, { childList: true, subtree: true });
    resolveHost();
    return () => observer.disconnect();
  }, [target]);
  return host ? createPortal(<div className="workspace-image-picker">{children}</div>, host) : null;
}
