import "src/components/globals.css"
import "src/components/icons.css"
import "flexlayout-react/style/light.css"
import "xterm/css/xterm.css"

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
  // console.log('onRouteUpdate', currentLocation.hash);

  const el = document.getElementById(currentLocation.hash.slice(1));
  if (currentLocation.hash.length <= 1 || !el) {
    return;
  }

  if (!prevLocation) {
    const { top } = el.getBoundingClientRect();
    // Immediate scroll to hash
    window.scrollBy({ top, behavior: 'auto' });

    setTimeout(() => {// Smooth scroll to previous window.scrollY
      const prevScrollY = Number(tryLocalStorageGet(localStorageKey.windowScrollY)??-1);
      prevScrollY !== -1 && window.scrollTo({ top: prevScrollY, behavior: 'smooth' });
    }, 300);

  } else if (prevLocation.hash !== currentLocation.hash) {
    const { top } = el.getBoundingClientRect();
    window.scrollBy({ top, behavior: 'smooth' });
    /**
     * TODO on user scroll, we should _stop scrolling_
     * e.g. by scrolling to current
     */
  }
}

//#endregion

export { wrapPageElement } from "./src/components/page/Root";
