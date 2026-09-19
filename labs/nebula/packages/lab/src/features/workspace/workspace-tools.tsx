import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { InfoTip } from '../../ui/info-tip';
import './workspace-tools.css';

interface ToolButton { id: string; label: string; tooltip?: string; icon: ReactNode; }
/** One floating tool: a round button beside the right sidebar that opens its panel over the canvas. */
export interface WorkspacePanelTool extends ToolButton { panel: ReactNode; }
/**
 * A round button that switches something on the canvas itself rather than opening a panel. Its pressed state is
 * owned by the caller; `aside` is a compact note shown beside the button while it matters (a legend).
 */
export interface WorkspaceToggleTool extends ToolButton { pressed: boolean; onToggle(): void; aside?: ReactNode; }
export type WorkspaceTool = WorkspacePanelTool | WorkspaceToggleTool;
const isPanel = (tool: WorkspaceTool): tool is WorkspacePanelTool => 'panel' in tool;

/**
 * A column of tool buttons anchored to the right sidebar's left edge, above the image credit; the open panel
 * fills the same column from below the section navigation to just above the buttons.
 * At most one panel is open; the button toggles it and Escape closes it. A tool that is briefly absent (a lens
 * switching, or no source image) hides with its panel and reopens it when it returns, so the panel follows the lens.
 */
export function WorkspaceTools({ tools }: { tools: readonly WorkspaceTool[] }) {
  const [host, setHost] = useState<Element | null>(null), [openId, setOpenId] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>()), panel = useRef<HTMLElement>(null);
  useEffect(() => { setHost(document.querySelector('.workspace-content')); }, []);
  const open = tools.filter(isPanel).find(tool => tool.id === openId), openTool = open?.id;
  useEffect(() => {
    if (!openTool) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const focused = panel.current?.contains(document.activeElement);
      setOpenId(null);
      if (focused) buttons.current.get(openTool)?.focus();
    };
    // Capture phase: a focused button's tooltip also consumes Escape, and one press must close the panel too.
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [openTool]);
  if (!host || tools.length === 0) return null;
  return createPortal(<div className="workspace-tools" style={{ '--workspace-tools-count': tools.length } as CSSProperties}>
    {open && <section ref={panel} id={`workspace-tool-panel-${open.id}`} className="workspace-tool-panel" role="dialog"
      aria-label={open.label} data-workspace-tool-panel={open.id}>
      <header className="workspace-tool-panel-header">
        <h2>{open.tooltip ?? open.label}</h2>
        <button type="button" className="workspace-tool-close" aria-label={`Close ${open.label}`}
          onClick={() => { setOpenId(null); buttons.current.get(open.id)?.focus(); }}>×</button>
      </header>
      {open.panel}
    </section>}
    <ul className="workspace-tool-buttons" aria-label="Canvas tools">
      {tools.map(tool => <li key={tool.id}>
        {!isPanel(tool) && tool.aside && <div className="workspace-tool-aside" data-workspace-tool-aside={tool.id}>{tool.aside}</div>}
        <InfoTip content={tool.tooltip ?? tool.label}>
          <button type="button" className="workspace-tool-button" data-workspace-tool={tool.id} aria-label={tool.label}
            aria-pressed={isPanel(tool) ? tool.id === open?.id : tool.pressed}
            aria-controls={tool.id === open?.id ? `workspace-tool-panel-${tool.id}` : undefined}
            ref={node => { if (node) buttons.current.set(tool.id, node); else buttons.current.delete(tool.id); }}
            onClick={() => isPanel(tool) ? setOpenId(current => current === tool.id ? null : tool.id) : tool.onToggle()}>{tool.icon}</button>
        </InfoTip>
      </li>)}
    </ul>
  </div>, host);
}
