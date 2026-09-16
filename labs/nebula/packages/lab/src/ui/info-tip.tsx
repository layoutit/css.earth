import { cloneElement, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import './info-tip.css';

/** The existing control owns its explanation, without an extra focus stop. */
export function InfoTip({ content, children }: { content: string; children: ReactElement<{ 'aria-describedby'?: string }> }) {
  const id = useId(), [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null), tooltip = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = tooltip.current, control = anchor.current;
    if (!node || !control) return;
    if (!open) { if (node.matches(':popover-open')) node.hidePopover(); return; }
    node.showPopover();
    const position = () => {
      const box = control.getBoundingClientRect(), tip = node.getBoundingClientRect();
      node.style.left = `${Math.max(8, Math.min(innerWidth - tip.width - 8, box.left + (box.width - tip.width) / 2))}px`;
      node.style.top = `${Math.max(8, box.bottom + tip.height + 8 > innerHeight ? box.top - tip.height - 6 : box.bottom + 6)}px`;
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); };
  }, [open]);
  return <span ref={anchor} className="info-tip workspace-mode-option" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
    onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
    {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
    <span ref={tooltip} id={id} className="info-tip-content" role="tooltip" popover="manual">{content}</span>
  </span>;
}
