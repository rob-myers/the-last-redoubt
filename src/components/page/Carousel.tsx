import React from "react";
import { css, cx } from "@emotion/css";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions } from "swiper";
import { Navigation, Zoom, Lazy, Pagination } from "swiper";
import type { VideoKey } from "./Video";
import Video from "./Video";

/**
 * props.items should be one of:
 * - a list of images definitions (with optional short labels)
 * - a list arbitrary `ReactNode`s
 */
export default function Carousel(props: Props) {

  const items = props.items;
  const isImages = isImageItems(items);

  return (
    <figure
      className={cx("carousel", rootCss)}
      style={props.style}
    >
      <Swiper
        breakpoints={props.breakpoints}
        lazy={props.lazy??{
          checkInView: true,
          enabled: true,
        }}
        modules={[Lazy, Navigation, Pagination, Zoom]}
        navigation
        pagination={props.pagination}
        spaceBetween={props.spaceBetween??20}
        style={{ height: props.height }}
        zoom
        onZoomChange={(_swiper, scale, _imgEl, slideEl) => {
          // https://github.com/nolimits4web/swiper/issues/3287
          if (scale === 1) slideEl.classList.remove('swiper-slide-zoomed');
        }}
        // onLazyImageReady={(_swiper, _slideEl, imgEl) => {// Didn't fix Lighthouse
        //   imgEl.setAttribute('width', `${imgEl.getBoundingClientRect().width}px`);
        // }}
      >
        {isImages
          ? items.map((item, i) =>
              'src' in item
                ? <SwiperSlide key={item.src}>
                    <div className="slide-container swiper-zoom-container">
                      {item.label && (
                        <div className="slide-label">
                          {item.label}
                        </div>
                      )}
                      <img
                        className="swiper-lazy"
                        data-src={`${props.baseSrc??''}${item.src}`}
                        height={props.height - (item.label ? labelHeightPx : 0)}
                        title={item.label}
                      />
                      <div className="swiper-lazy-preloader swiper-lazy-preloader-black"/>
                    </div>
                  </SwiperSlide>
                : <SwiperSlide key={i}>
                    <div className="slide-container slide-video-container">
                      {item.label && <div className="slide-label">{item.label}</div>}
                      <Video videoKey={item.video} />
                    </div>
                  </SwiperSlide>
            )
          : items.map((item, i) =>
              <SwiperSlide key={i}>
                <div
                  className={cx("slide-container", "slide-plain")}
                >
                  {item}
                </div>
              </SwiperSlide>
          )
        }
      </Swiper>
    </figure>
  );
}

const labelHeightPx = 38;

interface Props {
  baseSrc?: string;
  breakpoints?: SwiperOptions['breakpoints'];
  height: number;
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
  .slide-container {
    position: relative;
    user-select: none;
    display: flex;
    flex-direction: column;
  }
  .slide-video-container {
    align-items: center;
    height: 100%;
    figure.video {
      margin: 0;
      height: inherit;
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

  .swiper-slide.swiper-slide-zoomed {
    z-index: 1;
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
  }
  .swiper-slide.swiper-slide-zoomed .slide-label {
    color: white;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 4px;
  }
  img {
    border: thin solid var(--page-border-color);
    border-radius: 8px;
    background-color: #444;
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