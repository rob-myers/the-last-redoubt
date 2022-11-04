import React from "react";
import { css, cx } from "@emotion/css";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions } from "swiper";
import { Navigation, Lazy, Pagination } from "swiper";
import { enableBodyScroll, disableBodyScroll } from 'body-scroll-lock';
import useMeasure from "react-use-measure";

import { useDoubleTap } from 'projects/hooks/use-double-tap';
import type { VideoKey } from "./Video";
import Video from "./Video";
import useSiteStore from "store/site.store";

/**
 * props.items should be one of:
 * - a list of image/video definitions (with optional short labels)
 * - a list arbitrary `ReactNode`s
 */
export default function Carousel(props: Props) {

  const rootRef = React.useRef(null as null | HTMLElement);
  const [fullScreen, setFullScreen] = React.useState(false);

  // Render on resize window, or open/close nav
  const [measureRef] = useMeasure({ debounce: 30, scroll: true });
  useSiteStore(x => x.navOpen);

  function onDoubleTapSlide(e: React.MouseEvent) {
    e.stopPropagation();
    setFullScreen(true);
    disableBodyScroll(rootRef.current!);
    // Could provide slideId from data-slide-id on ancestral .slide-container
    // console.log('clicked el', e.target);
  }

  return (
    <figure
      className={cx("carousel", rootCss)}
      style={props.style}
      ref={x => {
        x && (rootRef.current = x);
        measureRef(x);
      }}
    >
      {!!fullScreen && <>
        <div
          className="fullscreen-overlay"
          onClick={() => {
            setFullScreen(false);
            enableBodyScroll(rootRef.current!);
          }}
        />
        <Slides
          fullScreen
          // 🚧 responsive offset
          fullScreenOffset={64 - rootRef.current!.getBoundingClientRect().y}
          items={props.items}
          baseSrc={props.baseSrc}
        />
      </>}
      <Slides
        {...props}
        onDoubleTapSlide={onDoubleTapSlide}
      />
    </figure>
  );
}

function Slides(props: Props & {
  fullScreen?: boolean;
  fullScreenOffset?: number;
  onDoubleTapSlide?: (e: React.MouseEvent) => void;
}) {
  const items = props.items; // For type inference
  const isImages = isImageItems(items);

  const bindDoubleTap = useDoubleTap((e) => props.onDoubleTapSlide?.(e));

  return (
    <Swiper
      className={cx({ 'full-screen': props.fullScreen })}
      breakpoints={props.breakpoints}
      lazy={props.lazy??{ checkInView: true, enabled: true }}
      modules={[Lazy, Navigation, Pagination]}
      navigation
      pagination={props.pagination}
      spaceBetween={props.spaceBetween??20}
      style={{
        height: props.height,
        marginTop: props.fullScreen ? props.fullScreenOffset : undefined, // CSS animated
      }}
      // onLazyImageReady={(_swiper, _slideEl, imgEl) => {// Didn't fix Lighthouse
      //   imgEl.setAttribute('width', `${imgEl.getBoundingClientRect().width}px`);
      // }}
    >
      {isImages && items.map((item, i) =>
        <SwiperSlide
          key={i}
          {...bindDoubleTap}
        >
          {'src' in item
            ? <div className="slide-container" data-slide-id={i}>
                {item.label && (
                  <div className="slide-label">
                    {item.label}
                  </div>
                )}
                <img
                  className="swiper-lazy"
                  data-src={`${props.baseSrc??''}${item.src}`}
                  height={
                    props.fullScreen || !props.height
                      ? undefined
                      : props.height - (item.label ? labelHeightPx : 0
                  )}
                  title={item.label}
                />
                <div className="swiper-lazy-preloader swiper-lazy-preloader-black"/>
              </div>
            : <div className="slide-container slide-video-container" data-slide-id={i}>
                {item.label && <div className="slide-label">{item.label}</div>}
                <Video videoKey={item.video} />
              </div>
          }
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

const labelHeightPx = 64; // 🚧 responsive

interface Props {
  baseSrc?: string;
  breakpoints?: SwiperOptions['breakpoints'];
  height?: number;
  items: CarouselItems;
  lazy?: SwiperOptions['lazy'];
  pagination?: SwiperOptions['pagination'];
  spaceBetween?: number;
  style?: React.CSSProperties;
}

type CarouselItems = (
  | ImageCarouselItem[]
  | PlainCarouselItem[]
);

type ImageCarouselItem = (
  | { src: string; label: string; }
  | { video: VideoKey; label: string; }
);
type PlainCarouselItem = React.ReactNode;

const rootCss = css`
  position: relative;
  
  .swiper {
    transition: margin-top 300ms ease-in;
  }

  .slide-container {
    position: relative;
    user-select: none;
    display: flex;
    flex-direction: column;
  }
  
  .swiper.full-screen {
    position: absolute;
    z-index: 2;
    width: 100%;
    
    .slide-container {
      align-items: center;
      .swiper-lazy-preloader {
        margin-top: 32px;
      }
    }

    background-color: #222;
    border: 4px solid #fff;
    border-radius: 8px;
    img {
      border: none;
      max-height: calc(100vh - 2 * 128px);
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


  .slide-video-container {
    align-items: center;
    height: 100%;
    figure.video {
      margin: 0;
      height: inherit;
      width: 75%;
      iframe {
        height: inherit;
      }
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

  .slide-label {
    padding: 8px;
    height: ${labelHeightPx}px;
    z-index: 1;
  
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-size: 1rem;
    font-weight: 300;
    line-height: 1.2;
    color: var(--page-font-color);

    text-align: center;
    display: flex;
    align-items: center;
    user-select: all;
  }
  img {
    border: thin solid var(--page-border-color);
    border-radius: 8px;
    object-fit: contain;
    max-width: 100%;
  }

  img.swiper-lazy + .slide-label {
    display: none;
  }
  img.swiper-lazy {
    visibility: hidden;
  }
  img.swiper-lazy.swiper-lazy-loaded + .slide-label {
    display: block;
  }
  img.swiper-lazy.swiper-lazy-loaded {
    visibility: visible;
  }
`;

function isImageItems(items: CarouselItems): items is ImageCarouselItem[] {
  return (
    items.length === 0
    || (!!items[0] && typeof items[0] === 'object' && 'src' in items[0])
  );
}
