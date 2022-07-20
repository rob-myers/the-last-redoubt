import React from "react";

/**
 * Based on:
 * > https://usehooks-ts.com/react-hook/use-intersection-observer#:~:text=This%20React%20Hook%20detects%20visibility,element%20(from%20useRef()%20).
 * @param {Opts} opts
 */
export function useIntersection({
  el, threshold = 0, root = null, rootMargin = '0%', cb,
}) {
  React.useEffect(() => {
    if (!window.IntersectionObserver || !(el instanceof HTMLElement)) {
      return;
    }
    /**
     * If callback is `debounce(foo)` and parent component is remounted,
     * we may need to cancel a pending invocation via this cleanup.
     */    
    let cleanup = /** @type {void | (() => void)} */ (undefined);
    const observer = new IntersectionObserver(
      ([e]) => cleanup = cb(e.isIntersecting, e),
      { threshold, root, rootMargin },
    )
    observer.observe(el)

    return () => {
      observer.disconnect();
      cleanup?.();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, JSON.stringify(threshold), root, rootMargin])

}

/**
 * @typedef ExtraOpts
 * @property {HTMLElement} [el] Undefined iff not mounted yet
 * @property {(intersects: boolean, entry: IntersectionObserverEntry) => (void | (() => void))} cb
 * 
 * @typedef {IntersectionObserverInit & ExtraOpts} Opts
 */
