import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions } from "swiper";
import { Navigation, Zoom } from "swiper";

export default function Carousel(props: Props) {
  return (
    <figure
      className="carousel"
    >
      <Swiper
        modules={[Zoom, Navigation]}
        navigation
        spaceBetween={20}
        breakpoints={props.breakpoints}
        style={{ height: props.height }}
        zoom
      >
        {props.items.map(({ src, label }) =>
          <SwiperSlide key={src}>
            <div className="slide-container swiper-zoom-container">
              <img
                src={`${props.baseSrc??''}${src}`}
                loading="lazy"
                title={label}
                height={props.height}
              />
              {label && (
                <div className="slide-label">
                  {label}
                </div>
              )}
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
}
