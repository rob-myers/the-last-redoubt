import "src/components/globals.css"
import "src/components/dark-mode.css"
import "src/components/icons.css"
import "flexlayout-react/style/light.css"
import "xterm/css/xterm.css"
import "swiper/css"
import "swiper/css/lazy"
import "swiper/css/navigation"
import "swiper/css/pagination"
import "swiper/css/zoom"

import ResizeObserver from 'resize-observer-polyfill';

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

//#region root wrapper

export { wrapPageElement } from "./src/components/page/Root";

//#endregion
