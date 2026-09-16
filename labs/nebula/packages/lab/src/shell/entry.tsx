import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';

const App = lazy(() => import('./App').then(module => ({ default: module.App })));
const CatalogueView = lazy(() => import('../pages/catalogue/catalogue-view').then(module => ({ default: module.CatalogueView })));

const root = createRoot(document.getElementById('app')!);
root.render(<Suspense fallback={<p role="status">Opening Nebula Lab…</p>}>
  {location.pathname.replace(/\/+$/, '') === '/catalogue' ? <CatalogueView /> : <App />}
</Suspense>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
