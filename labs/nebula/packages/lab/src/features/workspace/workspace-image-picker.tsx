import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** A stable top-of-rail slot keeps image selection ahead of method navigation. */
export function WorkspaceImagePicker({ children, target = 'inference-image-picker' }: { children: ReactNode; target?: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.getElementById(target)); }, [target]);
  return host ? createPortal(<div className="workspace-image-picker">{children}</div>, host) : null;
}
