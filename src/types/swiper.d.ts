/**
 * To avoid bundling e.g. unused Effect cards.
 */

declare module 'node_modules/swiper/modules/navigation/navigation.js' {
  import { Navigation } from 'swiper';
  export = Navigation;
}

declare module 'node_modules/swiper/modules/lazy/lazy.js' {
  import { Lazy } from 'swiper';
  export = Lazy;
}

declare module 'node_modules/swiper/modules/zoom/zoom.js' {
  import { Zoom } from 'swiper';
  export = Zoom;
}
