/** The plain building blocks every step panel uses: a titled section, one-line rows, big labelled buttons and a small
 * ⓘ link to where the detail lives. No paragraphs. */
import type { ReactNode } from 'react';
import './step-panel.css';

export function StepPanel({ label, children, wide = false, ...data }: { label: string; children: ReactNode; wide?: boolean } & Record<`data-${string}`, string | number | boolean | undefined>) {
  return <aside className={`floating-panel cloud-adjustment-panel step-panel${wide ? ' step-panel-wide' : ''}`} aria-label={label} {...data}>{children}</aside>;
}
export function StepSection({ title, info, children }: { title: string; info?: { url: string; label: string }; children: ReactNode }) {
  return <section className="step-section" aria-label={title}>
    <h2 className="step-section-title">{title}{info && <InfoLink {...info} />}</h2>
    {children}
  </section>;
}
/** One fact on one line: a short label, a value, and optional small links. */
export function StepRow({ label, children, state, ...data }: { label: string; children: ReactNode; state?: 'ok' | 'fail' | 'none' } & Record<`data-${string}`, string | number | boolean | undefined>) {
  return <div className="step-row" data-state={state} {...data}><span className="step-row-label">{label}</span><span className="step-row-value">{children}</span></div>;
}
export function InfoLink({ url, label }: { url: string; label: string }) {
  return <a className="step-info" href={url} target="_blank" rel="noreferrer" aria-label={label} title={label}>ⓘ</a>;
}
export function SmallLinks({ links }: { links: readonly { label: string; url: string }[] }) {
  if (!links.length) return <span className="step-muted">None</span>;
  return <span className="step-links">{links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" title={link.url}>{link.label}</a>)}</span>;
}
export interface BigButtonProps { id?: string; icon: string; label: string; pressed?: boolean; disabled?: boolean; title?: string; primary?: boolean; onClick(): void;
  data?: Record<`data-${string}`, string | number | boolean | undefined> }
/** A big, clearly labelled button, in the camera buttons' style. */
export function BigButton({ id, icon, label, pressed, disabled, title, primary, onClick, data }: BigButtonProps) {
  return <button id={id} type="button" className={`step-button${primary ? ' step-button-primary' : ''}`} aria-label={label} aria-pressed={pressed}
    disabled={disabled} title={title} onClick={onClick} {...data}><span aria-hidden="true">{icon}</span><span>{label}</span></button>;
}
export function BigButtons({ label, children, columns }: { label: string; children: ReactNode; columns?: number }) {
  return <div className="step-buttons" role="group" aria-label={label} style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}>{children}</div>;
}
