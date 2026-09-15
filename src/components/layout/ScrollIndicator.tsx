import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Mobile browsers largely ignore ::-webkit-scrollbar styling (iOS Safari drops it
 * entirely; Android Chrome shows a native overlay that fades before it's noticeable),
 * so the styled page scrollbar in index.css is invisible on phones. This renders an
 * always-visible, JS-driven scroll position indicator as a fallback that works on
 * every platform.
 */
export function ScrollIndicator() {
  const [metrics, setMetrics] = useState({ thumbHeight: 0, thumbTop: 0, visible: false });
  const [scrolling, setScrolling] = useState(false);
  const idleTimeout = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();

  useEffect(() => {
    const trackPadding = 4;

    const update = () => {
      const doc = document.documentElement;
      const viewportH = doc.clientHeight;
      const contentH = doc.scrollHeight;
      if (contentH <= viewportH + 1) {
        setMetrics(m => (m.visible ? { ...m, visible: false } : m));
        return;
      }
      const trackH = viewportH - trackPadding * 2;
      const thumbHeight = Math.max(32, (viewportH / contentH) * trackH);
      const maxScroll = contentH - viewportH;
      const maxThumbTravel = trackH - thumbHeight;
      const thumbTop = trackPadding + (doc.scrollTop / maxScroll) * maxThumbTravel;
      setMetrics({ thumbHeight, thumbTop, visible: true });
    };

    const onScroll = () => {
      update();
      setScrolling(true);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      idleTimeout.current = setTimeout(() => setScrolling(false), 500);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      resizeObserver.disconnect();
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, [location.pathname]);

  if (!metrics.visible) return null;

  return (
    <div
      aria-hidden
      className="fixed right-0.5 top-0 z-50 pointer-events-none transition-opacity duration-300"
      style={{ height: '100dvh', opacity: scrolling ? 1 : 0.45 }}
    >
      <div
        className="w-[9px] rounded-full transition-[background-color,box-shadow] duration-150"
        style={{
          position: 'absolute',
          top: metrics.thumbTop,
          height: metrics.thumbHeight,
          background: scrolling ? 'hsl(var(--primary) / 0.85)' : 'hsl(var(--muted-foreground) / 0.55)',
          boxShadow: scrolling ? '0 0 8px 1px hsl(var(--primary) / 0.6)' : 'none',
        }}
      />
    </div>
  );
}
