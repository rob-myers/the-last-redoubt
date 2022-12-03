import React from "react";
import { css, cx } from "@emotion/css";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions, Swiper as SwiperClass } from "swiper";
import type { SwiperEvents } from "swiper/types";
import { Navigation, Lazy, Pagination, Zoom } from "swiper";
import { enableBodyScroll, disableBodyScroll } from 'body-scroll-lock';
import useMeasure from "react-use-measure";

import { cssName } from "projects/service/const";
import useSiteStore from "store/site.store";
import useStateRef from "projects/hooks/use-state-ref";
import useUpdate from "projects/hooks/use-update";
import Video, { VideoKey } from "./Video";

// 🚧 remove class swiper-slide-zoomed onchange slide whilst zoomed
// 🚧 slide-img-container, figure.video height should be conditional on label existing

/**
 * props.items should be one of:
 * - a list of image/video definitions (with optional short labels)
 * - a list arbitrary `ReactNode`s
 */
export default function Carousel(props: Props) {

  const update = useUpdate();
  const state = useStateRef(() => ({
    rootEl: {} as HTMLElement,
    swiper: {} as SwiperClass,
    largeSwiper: null as null | SwiperClass,
    /** Number is initial slide when full screen */
    fullScreen: null as null | number,
  }));

  // Render on resize window, or open/close nav
  const [measureRef, bounds] = useMeasure({ debounce: 30, scroll: true });
  const navOpen = useSiteStore(x => x.navOpen);

  function showFullScreen(slideId?: number) {
    state.fullScreen = slideId??state.swiper.activeIndex;
    disableBodyScroll(state.rootEl);
    update();
  }
  function hideFullScreen() {
    state.fullScreen = null;
    enableBodyScroll(state.rootEl);
    state.rootEl.focus();
    update();
  }

  React.useEffect(() => {
    (!navOpen && state.fullScreen !== null) && setTimeout(() => state.rootEl.focus(), 50);
  }, [navOpen]);

  return (
    <figure
      ref={el => {
        el && (state.rootEl = el);
        measureRef(el);
      }}
      className={cx("carousel", rootCss)}
      style={props.style}

      tabIndex={0}
      onKeyUp={e => {
        switch (e.key) {
          case 'Escape': hideFullScreen(); break;
          case 'Enter': showFullScreen(); break;
          case 'ArrowLeft':
          case 'ArrowRight': {
            const swiper = state.largeSwiper || state.swiper;
            swiper.slideTo(swiper.activeIndex + (e.key === 'ArrowLeft' ? -1 : 1));
            break;
          }
        }
      }}
    >
      {typeof state.fullScreen === 'number' && <>
        <div
          className="fullscreen-overlay"
          onClick={hideFullScreen}
        />
        <Slides
          fullScreen
          // 🚧 responsive offset
          fullScreenOffset={128 - state.rootEl.getBoundingClientRect().y}
          initialSlide={state.fullScreen}
          items={props.items}
          baseSrc={props.baseSrc}
          onDestroy={_swiper => state.largeSwiper = null}
          onSwiper={swiper => {
            state.largeSwiper = swiper;
            swiper.el.focus();
          }}
          />
      </>}
      <Slides
        {...props}
        initialSlide={props.initialSlide}
        smallViewport={bounds.width <= 600}
        showFullScreen={showFullScreen}
        onSwiper={swiper => state.swiper = swiper}
      />
    </figure>
  );
}

function Slides(props: Props & {
  fullScreen?: boolean;
  fullScreenOffset?: number;
  smallViewport?: boolean;
  showFullScreen?: (slideId?: number) => void;
}) {
  const items = props.items; // For type inference
  const isImages = isImageItems(items);
  const canZoom = props.smallViewport;

  return (
    <Swiper
      className={cx({ 'full-screen': props.fullScreen })}
      breakpoints={props.breakpoints}
      lazy={props.lazy??{ checkInView: true, enabled: true }}
      initialSlide={props.initialSlide}
      modules={[Lazy, Navigation, Pagination, Zoom]}
      navigation
      onClick={swiper => props.fullScreen && swiper.el.focus()}
      onSwiper={props.onSwiper}
      onDestroy={props.onDestroy}
      pagination={props.pagination}
      spaceBetween={props.spaceBetween??40}
      style={{
        height: props.height,
        marginTop: props.fullScreen ? props.fullScreenOffset : undefined, // CSS animated
      }}
      zoom={canZoom}
      tabIndex={props.fullScreen ? 0 : undefined}
      // onLazyImageReady={(_swiper, _slideEl, imgEl) => {// Didn't fix Lighthouse
      //   imgEl.setAttribute('width', `${imgEl.getBoundingClientRect().width}px`);
      // }}

    >
      {isImages && items.map((item, i) =>
        <SwiperSlide
          key={i}
          // onClick={e => e.currentTarget.closest('.carousel')?.focus()}
          {...!props.smallViewport && {
            onDoubleClick(el) {
              const dataSlideId = (el.target as HTMLElement).closest('.slide-container')?.getAttribute('data-slide-id');
              const slideId = typeof dataSlideId === 'string' ? Number(dataSlideId) : 0;
              props.showFullScreen?.(slideId);
            }
          }}
        >
          <div
            className={cx("slide-container", { "slide-video-container": 'video' in item })}
            data-slide-id={i}
          >
            {'src' in item && <>
              {item.label && <div className="slide-label">{item.label}</div>}
              <div className={cx('slide-img-container', { 'swiper-zoom-container': canZoom })}>
                <img
                  className="swiper-lazy"
                  data-src={`${props.baseSrc??''}${item.src}`}
                  {...item.background && { style: { background: item.background } }}
                />
              </div>
              <div className="swiper-lazy-preloader swiper-lazy-preloader-black"/>
            </>}

            {'video' in item && <>
              {item.label && <div className="slide-label">{item.label}</div>}
              <Video videoKey={item.video} />
            </>}
            
          </div>
        </SwiperSlide>
      )}

      {!isImages && items.map((item, i) =>
        <SwiperSlide key={i}>
          <div className="slide-container slide-plain" data-slide-id={i}>
            {item}
          </div>
        </SwiperSlide>
      )}
    </Swiper>
  );
}

const maxHeightPx = 800;

const rootCss = css`
  ${cssName.carouselLabelHeight}: 96px;

  position: relative;
  
  .swiper {
    transition: margin-top 300ms ease-in 300ms;
  }

  .slide-container {
    height: inherit;
  }

  .slide-label {
    display: flex;
    justify-content: center;
    align-items: center;

    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-size: 1.1rem;
    font-weight: 300;
    line-height: 1.2;
    min-height: var(${cssName.carouselLabelHeight});
  }

  .slide-img-container {
    display: flex;
    justify-content: center;
    /* 🚧 Handle case where label does not exist */
    height: calc(100% - var(${cssName.carouselLabelHeight}) - 16px);
    img {
      object-fit: contain;
      max-width: 100%;
    }
  }

  figure.video {
    margin: 0;
    /* 🚧 Handle case where label does not exist */
    height: calc(100% - var(${cssName.carouselLabelHeight})  - 16px);
  }
  
  .swiper.full-screen {
    position: absolute;
    z-index: 2;
    width: calc(100%);
    /* height: calc(min(${maxHeightPx}px, 100vh - 128px)); */
    background-color: var(--carousel-background-color);
    border: 4px solid var(--contrast-border-color);
  
    img {
      border: none;
      height: inherit;
      max-height: calc(100vh - 2 * 128px);
      padding-bottom: 96px;
    }
    figure {
      padding-bottom: 96px;
    }
    .slide-video-container {
      display: block;
      height: calc(100% - var(${cssName.carouselLabelHeight}));
    }
    .swiper-lazy-preloader {
      top: unset;
      margin-top: unset;
    }
    @media(max-width: 600px) {
      border-width: 1px;
    }
  }

  div.fullscreen-overlay {
    position: fixed;
    background-color: #00000088;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2;
  }

  .swiper-slide-zoomed .slide-label {
    background-color: var(--carousel-background-color);
    opacity: 0.9;
    position: relative;
    width: 100%;
    z-index: 1;
  }

  img.swiper-lazy {
    visibility: hidden;
    &.swiper-lazy-loaded {
      visibility: visible;
    }
  }

  .slide-plain {
    border: 1px solid var(--page-border-color);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    text-align: center;
    height: 100%;
    width: 100%;
    padding: 0 48px;

    line-height: 1.8;
    p {
      margin-bottom: 8px;
    }
  }
`;

function isImageItems(items: CarouselItems): items is ImageCarouselItem[] {
  return (
    items.length === 0
    || (!!items[0] && typeof items[0] === 'object' && ('src' in items[0] || 'video' in items[0]))
  );
}

interface Props {
  baseSrc?: string;
  height?: number;
  items: CarouselItems;
  //#region swiper
  breakpoints?: SwiperOptions['breakpoints'];
  initialSlide?: number;
  lazy?: SwiperOptions['lazy'];
  onDestroy?: SwiperEvents['destroy'];
  onSwiper?: SwiperEvents['_swiper'];
  pagination?: SwiperOptions['pagination'];
  spaceBetween?: number;
  style?: React.CSSProperties;
  //#endregion
}

type CarouselItems = (
  | ImageCarouselItem[]
  | PlainCarouselItem[]
);

type ImageCarouselItem = (
  | { src: string; label?: string; background?: string; }
  | { video: VideoKey; label?: string; }
);
type PlainCarouselItem = React.ReactNode;
