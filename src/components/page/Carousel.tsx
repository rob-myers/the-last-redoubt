import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper";

export default function Carousel(props: Props) {
  return (
    <figure
      className="carousel"
    >
      <Swiper
        modules={[Navigation]}
        navigation
        spaceBetween={20}
        // centeredSlides
        breakpoints={{
          300: {
            slidesPerView: 1,
          },
          450: {
            slidesPerView: 2,
          },
          900: {
            slidesPerView: 3,
          },
        }}
        style={{ height: props.height }}
        // onResize={() => setSlidesPerView(window.matchMedia('(max-width: 700px) and (min-width: 600px)').matches ? 1 : 2)}
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
  height: number;
  items: { src: string; label: string; }[];
}

interface State {
  computeResponsive(): void;
  rootEl: HTMLElement;
  slidesPerView: number;
  /** Seems to mean _minimum_ spaceBetween. */
  spaceBetween: number;
}
