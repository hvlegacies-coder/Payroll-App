import { useEffect, useRef } from 'react';

/**
 * Toggles an "is-scrolling" class on `target` while it's actively being scrolled,
 * removing it shortly after scrolling stops. Used to drive the scrollbar glow effect.
 */
export function useScrollGlow(target: EventTarget | null | undefined, className = 'is-scrolling', idleMs = 300) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!target) return;
    const el = target as HTMLElement | Window;
    const classList = (el instanceof Window ? document.documentElement : el).classList;

    const onScroll = () => {
      classList.add(className);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => classList.remove(className), idleMs);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      classList.remove(className);
    };
  }, [target, className, idleMs]);
}
