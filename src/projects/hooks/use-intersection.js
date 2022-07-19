import React from "react";

/**
 * Based on:
 * > https://usehooks-ts.com/react-hook/use-intersection-observer#:~:text=This%20React%20Hook%20detects%20visibility,element%20(from%20useRef()%20).
 * @param {undefined | HTMLElement} el 
 * @param {IntersectionObserverInit & { cb?(intersects: boolean): void }} opts 
 * @returns {undefined | IntersectionObserverEntry}
 */
export function useIntersection(
  el,
  { threshold = 0, root = null, rootMargin = '0%', cb },
) {
  const [entry, setEntry] = React.useState(
    /** @type {undefined | IntersectionObserverEntry} */ (undefined)
  );

  React.useEffect(() => {
    if (!window.IntersectionObserver || !(el instanceof HTMLElement)) {
      return;
    } else {
      const observer = new IntersectionObserver(
        ([e]) => { setEntry(e); cb?.(e.isIntersecting); },
        { threshold, root, rootMargin },
      )
      observer.observe(el)
      return () => observer.disconnect()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, JSON.stringify(threshold), root, rootMargin])

  return entry
}
