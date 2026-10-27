import Icon from './components/Icon.jsx';
import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
const Learn = lazy(() => import('./pages/Learn.jsx'));
const BuildReview = lazy(() => import('./review/BuildReview.jsx'));
const Arena = lazy(() => import('./arena/Arena.jsx'));
const ConceptMap = lazy(() => import('./learning/ConceptMap.jsx'));
import Settings from './pages/Settings.jsx';
import Account from './pages/Account.jsx';
import Desk from './pages/Desk.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { accountsEnabled } from './lib/supabase.js';
import { hideParams } from './lib/url-state.js';

const readRoute = () => { const path = location.pathname.replace(/\/$/, '') || '/'; if (['/practice', '/community'].includes(path)) return '/arena'; return ['/source', '/documents', '/inspections', '/reports'].includes(path) ? '/learn' : path; };
export default function App() {
  // visit changes whenever the address changes, so following a link to the same page (for
  // example a saved build → /build) opens it fresh.
  const [route, setRoute] = useState(readRoute), [visit, setVisit] = useState(0);
  useEffect(() => {
    // Keep previously shared hash links working, including same-document navigation.
    const onPopState = () => {
      if (location.pathname === '/' && location.hash.startsWith('#/')) {
        history.replaceState(null, '', location.hash.slice(1) + location.search);
      }
      const shown = hideParams(location.href);
      if (shown !== location.pathname + location.search) history.replaceState(null, '', shown);
      setRoute(readRoute()); setVisit(v => v + 1);
    };
    onPopState();
    const onClick = event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.hash) return;
      event.preventDefault();
      const shown = hideParams(url.href, { fresh: true });
      if (url.href !== location.href) { history.pushState(null, '', shown); setVisit(v => v + 1); }
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
  const titles = { '/': 'Understand it. Then build it.', '/build':'Build review', '/arena':'Arena', '/concepts':'Concept map', '/workspace': 'Learning desk', '/learn': 'Learning desk', '/settings': 'Settings', '/signin': 'Sign in', '/desk': 'My desk' };
  useEffect(() => { document.title = `Pinlight · ${titles[route] || 'Page not found'}`; }, [route]);
  let page = <Home />;
  if (['/learn','/workspace'].includes(route)) page = <Learn />;
  else if(route==='/build') page=<BuildReview/>;
  else if(route==='/arena') page=<Arena/>;
  else if(route==='/concepts') page=<ConceptMap/>;
  else if (route === '/settings') page = <Settings />;
  else if (accountsEnabled && route === '/signin') page = <Account />;
  else if (accountsEnabled && route === '/desk') page = <Desk />;
  else if (route !== '/') page = <section className="section-wrap app-page"><h1>That page isn’t here.</h1><a className="text-link" href="/"><>{"Return to overview "}<Icon name="arrow" size={16}/></></a></section>;
  return <AuthProvider><a className="skip-link" href="#main-content">Skip to content</a><Layout route={route}><Suspense fallback={<section className="section-wrap app-page"><p role="status">Opening your workspace…</p></section>}><Fragment key={visit}>{page}</Fragment></Suspense></Layout></AuthProvider>;
}
