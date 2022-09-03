import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, SwiperOptions } from "swiper";

export default function Carousel(props: Props) {
  return (
    <figure
      className="carousel"
    >
      <Swiper
        modules={[Navigation]}
        navigation
        spaceBetween={20}
        breakpoints={props.breakpoints}
        style={{ height: props.height }}
      >
        {props.items.map(({ src, label }) =>
          <SwiperSlide key={src}>
            <img
              src={`${props.baseSrc??''}${src}`}
              loading="lazy"
              title={label}
              height={props.height}
            />
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
