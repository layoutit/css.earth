import { ObjectPicker } from './object-picker';
import type { MouseEvent } from 'react';
import { labPageUrl, type LabPage } from '../features/legacy-viewer/lab-routing';

export interface NavigationObject { id: string; name: string }
interface Props {
  page: LabPage;
  objectId: string;
  objects: readonly NavigationObject[];
  onObjectChange(id: string): void;
  onViewChange?(page: 'alignment' | 'reconstruction'): void;
  busy?: boolean;
  alignmentAvailable: boolean;
  reconstructionAvailable: boolean;
  method?: string;
}
/** One navigation order and object context for every lab page. */
export function LabNavigation(props: Props) {
  function activate(event: MouseEvent<HTMLAnchorElement>, page: LabPage) {
    if (page === 'catalogue' || !props.onViewChange || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); props.onViewChange(page);
  }
  return <header className="lab-header">
    <h1>Nebula Lab</h1>
    <nav className="lab-navigation" aria-label="Lab navigation">
      {(['catalogue', 'alignment', 'reconstruction'] as const).map(page => {
        const unavailable = page === 'alignment' ? !props.alignmentAvailable : page === 'reconstruction' ? !props.reconstructionAvailable : false;
        const title = unavailable ? `No ${page} workspace is configured for this object.` : undefined;
        const label = page[0]!.toUpperCase() + page.slice(1);
        const href = labPageUrl(new URL(location.href), page, props.objectId);
        return unavailable || props.busy && page !== props.page ? <span key={page} className="lab-navigation-disabled" aria-disabled="true" title={title ?? 'Loading the selected object…'}>{label}</span> :
          <a key={page} id={page === 'alignment' ? 'density-tab' : page === 'reconstruction' ? 'render-tab' : 'catalogue-tab'}
            href={href.pathname + href.search + href.hash}
            aria-current={page === props.page ? 'page' : undefined} onClick={event => activate(event, page)}>{label}</a>;
      })}
    </nav>
    <div className="subject-field" title={props.method}>
      <ObjectPicker value={props.objectId} objects={props.objects} disabled={props.busy} onChange={props.onObjectChange} />
    </div>
  </header>;
}
