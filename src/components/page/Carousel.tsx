import React from "react";
import { css, cx } from "@emotion/css";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions } from "swiper";
import { Navigation, Zoom, Lazy } from "swiper";

export default function Carousel(props: Props) {
  return (
    <figure
      className={cx("carousel", rootCss)}
    >
      <Swiper
        breakpoints={props.breakpoints}
        lazy
        modules={[Zoom, Navigation, Lazy]}
        navigation
        spaceBetween={props.spaceBetween??20}
        style={{ height: props.height }}
        zoom
      >
        {props.items.map(({ src, label }) =>
          <SwiperSlide key={src}>
            <div className="slide-container swiper-zoom-container">
              <img
                className="swiper-lazy"
                data-src={`${props.baseSrc??''}${src}`}
                height={props.height}
                title={label}
              />
              {label && (
                <div className="slide-label">
                  {label}
                </div>
              )}
              <div
                className="swiper-lazy-preloader swiper-lazy-preloader-black"
              />
            </div>
          </SwiperSlide>
        )}
      </Swiper>
    </figure>
  );
}

interface Props {
  baseSrc?: string;
  breakpoints?: SwiperOptions['breakpoints'];
  height: number;
  items: { src: string; label: string; }[];
  spaceBetween?: number;
}

const rootCss = css`
   .slide-container {
      width: fit-content;
      position: relative;
      user-select: none;
    }
    img {
      border: medium solid #444;
      border-radius: 8px;
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
