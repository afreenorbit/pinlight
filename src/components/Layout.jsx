import Icon from './Icon.jsx';
import { useAuth } from '../lib/auth.jsx';
import { accountsEnabled } from '../lib/supabase.js';

export function Brand() {
  return <a href="/" className="brand" aria-label="Pinlight home"><span className="brand-mark">P<span /></span>pinlight<span className="brand-period">.</span></a>;
}

export default function Layout({ route, children }) {
  const { user } = useAuth();
  return <div className={`app-shell ${['/learn','/workspace'].includes(route)?'workspace-shell':''}`}>
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">
        {[['/', 'Overview'], ['/learn', 'Learning desk'], ...(accountsEnabled ? [['/desk', 'My desk']] : [])].map(([path, title]) => <a key={path} href={path} aria-current={route === path ? 'page' : undefined}>{title}</a>)}
      </nav>
      {!accountsEnabled ? <a className="header-action" href="/learn">Start learning <Icon name="diagonal" size={16} /></a> : user ? <a className="header-action" href="/signin" title={user.email}><span className="avatar-dot">{user.email[0].toUpperCase()}</span> Account</a> : <a className="header-action" href="/signin">Sign in <Icon name="diagonal" size={16} /></a>}
    </header>
    <main id="main-content">{children}</main>
    <footer className="site-footer"><Brand /><span>Find the spark. Follow your curiosity.</span><a href="/settings">Learning settings <Icon name="settings" size={15} /></a><small>© {new Date().getFullYear()} Pinlight</small></footer>
  </div>;
}
