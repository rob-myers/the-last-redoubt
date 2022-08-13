import "src/components/globals.css"
import "src/components/icons.css"
import "flexlayout-react/style/light.css"
import "xterm/css/xterm.css"

//#region polyfill

import ResizeObserver from 'resize-observer-polyfill';

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

export { wrapPageElement } from "./src/components/page/Root";

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
    window.scrollBy({ top, behavior: 'auto' });
  } else if (prevLocation.hash !== currentLocation.hash) {
    const { top } = el.getBoundingClientRect();
    window.scrollBy({ top, behavior: 'smooth' });
    /**
     * TODO on user scroll,
     * stop scrolling by scrolling to current
     */
  }
}