import React from "react";

/**
 * Based on:
 * > https://usehooks-ts.com/react-hook/use-intersection-observer#:~:text=This%20React%20Hook%20detects%20visibility,element%20(from%20useRef()%20).
 * @param {Opts} opts
 */
export function useIntersection({
  elRef,
  cb,
  threshold = 0, root = null, rootMargin = '0%',
}) {
  const el = elRef();

  React.useEffect(() => {
    if (!window.IntersectionObserver || !el) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        /**
         * Remounting can trigger an observation with
         * `isIntersecting` false before we can unobserve.
         * Thankfully we can catch it here.
         */
        const currEl = elRef();
        if (entry.target !== currEl) {
          observer.unobserve(entry.target);
          currEl && observer.observe(currEl);
        } else {
          cb(entry.isIntersecting, entry);
        }
      },
      { threshold, root, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, JSON.stringify(threshold), root, rootMargin])

}

/**
 * @typedef ExtraOpts
 * @property {() => HTMLElement | null} elRef
 * @property {(intersects: boolean, entry: IntersectionObserverEntry) => void} cb
 * 
 * @typedef {IntersectionObserverInit & ExtraOpts} Opts
 */
