import { lazy, Suspense, useEffect, useState } from 'react';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
const Learn = lazy(() => import('./pages/Learn.jsx'));
import Settings from './pages/Settings.jsx';
import Account from './pages/Account.jsx';
import Desk from './pages/Desk.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { accountsEnabled } from './lib/supabase.js';

const readRoute = () => { const path = location.pathname.replace(/\/$/, '') || '/'; return ['/source', '/documents', '/inspections', '/reports'].includes(path) ? '/learn' : path; };
export default function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    // Keep previously shared hash links working, including same-document navigation.
    const onPopState = () => {
      if (location.pathname === '/' && location.hash.startsWith('#/')) {
        history.replaceState(null, '', location.hash.slice(1) + location.search);
      }
      setRoute(readRoute());
    };
    onPopState();
    const onClick = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.hash) return;
      event.preventDefault();
      if (url.href !== location.href) history.pushState(null, '', url.pathname + url.search);
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
      document.removeEventListener('click', onClick);
    };
  }, []);
  const titles = { '/': 'Let a little light come on', '/workspace': 'Learning desk', '/learn': 'Learning desk', '/source': 'Source workspace', '/documents': 'Documents', '/inspections': 'Inspections', '/reports': 'Reports', '/settings': 'Settings', '/signin': 'Sign in', '/desk': 'My desk' };
  useEffect(() => { document.title = `Pinlight · ${titles[route] || 'Page not found'}`; }, [route]);
  let page = <Home />;
  if (['/learn','/workspace'].includes(route)) page = <Learn />;
  else if (route === '/settings') page = <Settings />;
  else if (accountsEnabled && route === '/signin') page = <Account />;
  else if (accountsEnabled && route === '/desk') page = <Desk />;
  else if (route !== '/') page = <section className="section-wrap app-page"><h1>That page isn’t here.</h1><a className="text-link" href="/">Return to overview →</a></section>;
  return <AuthProvider><a className="skip-link" href="#main-content">Skip to content</a><Layout route={route}><Suspense fallback={<section className="section-wrap app-page"><p role="status">Opening your learning desk…</p></section>}>{page}</Suspense></Layout></AuthProvider>;
}
