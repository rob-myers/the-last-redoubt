import "src/components/globals.css"
import "flexlayout-react/style/light.css"
import "xterm/css/xterm.css"

//#region polyfill

import ResizeObserver from 'resize-observer-polyfill';

if (!window.ResizeObserver) {
  window.ResizeObserver = ResizeObserver;
}

//#endregion

export { wrapPageElement } from "./src/components/page/Root";
