import { useEffect, useRef } from 'react';

export default function ScrollReveal({ children, className = '', delay = 0 }) {
  const element = useRef(null);
  useEffect(() => {
    const node = element.current;
    if (!node || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    node.dataset.reveal = 'waiting';
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        node.dataset.reveal = 'visible';
        observer.disconnect();
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
    observer.observe(node);
    return () => { observer.disconnect(); delete node.dataset.reveal; };
  }, []);
  return <div ref={element} className={`scroll-reveal ${className}`} style={{ '--reveal-delay': `${delay}ms` }}>{children}</div>;
}
