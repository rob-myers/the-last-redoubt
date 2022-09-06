import React from "react";
import { css, cx } from "@emotion/css";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions } from "swiper";
import { Navigation, Zoom, Lazy, Pagination } from "swiper";

/**
 * props.items should be either:
 * - a list of images definitions, or
 * - a list arbitrary `ReactNode`s
 */
export default function Carousel(props: Props) {

  const items = props.items;
  const isImages = isImageItems(items);

  return (
    <figure
      className={cx("carousel", rootCss)}
    >
      <Swiper
        breakpoints={props.breakpoints}
        lazy
        modules={[Lazy, Navigation, Pagination, Zoom]}
        navigation={{

        }}
        pagination={props.pagination}
        spaceBetween={props.spaceBetween??20}
        style={{ height: props.height }}
        zoom
      >
        {isImages
          ? items.map(item =>
              <SwiperSlide key={item.src}>
                <div
                  className={cx("slide-container", "swiper-zoom-container")}
                >
                <img
                  className="swiper-lazy"
                  data-src={`${props.baseSrc??''}${item.src}`}
                  height={props.height}
                  title={item.label}
                />
                {item.label && (
                  <div className="slide-label">
                    {item.label}
                  </div>
                )}
                <div
                  className="swiper-lazy-preloader swiper-lazy-preloader-black"
                />
                </div>
              </SwiperSlide>
            )
          : items.map((item, i) =>
              <SwiperSlide key={i}>
                <div
                  className={cx("slide-container", "slide-centered")}
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

interface Props {
  baseSrc?: string;
  breakpoints?: SwiperOptions['breakpoints'];
  height: number;
  items: CarouselItems;
  pagination?: SwiperOptions['pagination'];
  spaceBetween?: number;
}

type CarouselItems = (
  | ImageCarouselItem[]
  | PlainCarouselItem[]
);

type ImageCarouselItem = { src: string; label: string; };
type PlainCarouselItem = React.ReactNode;

const rootCss = css`
   .slide-container {
      width: fit-content;
      position: relative;
      user-select: none;

      line-height: 1.8;
      p {
        margin-bottom: 16px;
      }
      @media (max-width: 600px) {
        line-height: 1.6;
        p {
          margin-bottom: 8px;
        }
      }
    }
    .slide-centered {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;

      text-align: center;
      height: 100%;

      padding: 0 48px;
      font-size: 1rem;
    }

    .swiper-slide.swiper-slide-zoomed {
      z-index: 1;
    }

    img {
      border: medium solid #444;
      border-radius: 8px;
      background-color: #444;
    }
    .slide-label {
      position: absolute;
      top: 0;
      width: 100%;
      padding: 8px;

      font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
      font-size: 1rem;
      color: white;
      background-color: rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      text-align: center;
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