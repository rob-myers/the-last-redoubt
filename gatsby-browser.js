import "src/components/globals.css"
import "src/components/icons.css"
import "flexlayout-react/style/light.css"
import "xterm/css/xterm.css"

import { navigate } from "gatsby";
import ResizeObserver from 'resize-observer-polyfill';

import { tryLocalStorageGet } from './src/projects/service/generic';
import { localStorageKey } from './src/projects/service/const';

//#region polyfill

if (!window.ResizeObserver) {
  window.ResizeObserver = ResizeObserver;
}

if (!document.documentElement.onpointerdown) {
  import('pepjs');
}

if (!window.Animation) {
  // Doesn't actually provide window.Animation
  // Does provide element.animate()
  // Does provide element.getAnimations()
  import('web-animations-js/web-animations-next.min.js');
}

//#endregion

//#region scroll

/**
 * https://stackoverflow.com/a/69807698/2917822
 * @param {import('gatsby').ShouldUpdateScrollArgs} arg
 */
export function shouldUpdateScroll({
  routerProps: { location },
  getSavedScrollPosition,
}) {
  return location.href.indexOf("#") > -1 ? false : true;
};

/**
 * @param {import('gatsby').RouteUpdateArgs} location 
 */
export async function onRouteUpdate(location) {
  const { prevLocation, location: currentLocation } = location;
  
  /**
   * TODO cancel smooth scroll on user scroll
   */

  const el = document.getElementById(currentLocation.hash.slice(1));
  if (currentLocation.hash.length <= 1 || !el) {
    return;
  }

  if (!prevLocation) {
    // Immediate scroll to hash
    const { top } = el.getBoundingClientRect();
    window.scrollBy({ top, behavior: 'auto' });

    setTimeout(() => {
      const prevScrollY = Number(tryLocalStorageGet(localStorageKey.windowScrollY)??-1);
      if (prevScrollY >= 0) {// Smooth scroll to previous window.scrollY
        window.scrollTo({ top: prevScrollY, behavior: 'smooth' });
      }
      if (Math.abs(prevScrollY - window.scrollY) > 400) {// Forget hash
        setTimeout(() => navigate(`${currentLocation.pathname}#`), 1000);
      }
    }, 300);

  } else if (prevLocation.hash !== currentLocation.hash) {
    const { top } = el.getBoundingClientRect();
    window.scrollBy({ top, behavior: 'smooth' });
  }
}

//#endregion

//#region root wrapper

export { wrapPageElement } from "./src/components/page/Root";

//#endregion
