import React from "react";
import { css, cx } from "@emotion/css";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions } from "swiper";
import { Navigation, Zoom, Lazy, Pagination } from "swiper";

export default function Carousel(props: Props) {
  return (
    <figure
      className={cx("carousel", rootCss)}
    >
      <Swiper
        breakpoints={props.breakpoints}
        lazy
        modules={[Lazy, Navigation, Pagination, Zoom]}
        navigation
        pagination={props.pagination}
        spaceBetween={props.spaceBetween??20}
        style={{ height: props.height, ...props.style }}
        zoom
      >
        {props.items.map((item, i) => {
          const isImage = isImageItem(item);
          return (
            <SwiperSlide key={isImage ? item.src : i}>
              <div className={cx("slide-container", "swiper-zoom-container")}>
                {isImage ? <>
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
                </> : item}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </figure>
  );
}

interface Props {
  baseSrc?: string;
  breakpoints?: SwiperOptions['breakpoints'];
  height: number;
  items: CarouselItem[];
  pagination?: SwiperOptions['pagination'];
  spaceBetween?: number;
  style?: React.CSSProperties;
}

type CarouselItem = (
  | { src: string; label: string; }
  | React.ReactNode
);

const rootCss = css`
   .slide-container {
      width: fit-content;
      position: relative;
      user-select: none;

      flex-direction: column;
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

function isImageItem(item: CarouselItem): item is Extract<CarouselItem, { src: string }> {
  return !!item && typeof item === 'object' && 'src' in item;
}