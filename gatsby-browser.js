import "src/components/globals.css"
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
  import('web-animations-js');
}

//#endregion

export { wrapPageElement } from "./src/components/page/Root";
