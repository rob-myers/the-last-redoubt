import React from "react";
import { css, cx } from "@emotion/css";
import debounce  from "debounce";
import Carousel, { BaseProps as CarouselProps } from "./Carousel";

export default function ImageCarousel(props: Props) {

  React.useEffect(() => {
    const slideDim = props.slideWidth + (props.marginRight??0);
    const scrolled = document.querySelector(`#${props.id} .slides`);
    if (!scrolled) {
      return;
    }
    const images = Array.from(scrolled.children).map(slideContainer =>
      slideContainer.children[0].children[1] as HTMLImageElement
    );

    const onEndScroll = debounce(() => {
      // Need offset for Android Chrome
      const slideId = Math.floor((scrolled.scrollLeft + 5) / slideDim);
      images.forEach((slide, id) => slide.style.opacity = `${Number(slideId === id)}`);
    }, 50);

    onEndScroll();
    scrolled.addEventListener('scroll', onEndScroll);
    return () => scrolled.removeEventListener('scroll', onEndScroll);

  }, [props.id]);

  return (
    <Carousel
      id={props.id}
      slideWidth={props.slideWidth}
      width={props.width}
      height={props.height}
      marginRight={props.marginRight}
      className={cx(props.className, rootCss)}
    >
      {props.items.map(({ src, label }) =>
        <div key={src} className="slide">
          <div
            className="slide-label"
            style={{ top: props.labelTop }}
          >
            {label}
          </div>
          <img
            src={`${props.baseSrc || ''}${src}`}
            style={props.imgStyles}
            loading="lazy"
          />
        </div>
      )}
    </Carousel>
  );
}

interface Props extends CarouselProps {
  id: string;
  items: { src: string; label: string; }[];
  baseSrc?: string;

  imgStyles?: React.CSSProperties;
  labelTop?: string;
}

const rootCss = css`
  .slide-container {
    border-radius: 8px 8px;
    border-width: 8px 0 0 0;
    border: 1px solid #555;
  }
  .slides::-webkit-scrollbar-track {
    border: 0 solid #777;
  }
  .slide {
    height: 100%;
    overflow: hidden;
  }
  .slide img {
    opacity: 0;
    transition: opacity 300ms ease-in-out;
    width: 100%; // Safari
  }
  .slide-label {
    position: absolute;
    left: 0px;
    width: 100%;
    color: white;
    font-size: 18px;
    font-family: Monaco;
    font-weight: 300;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid #444;
    padding: 16px;
    text-transform: lowercase;
    z-index: 1;
  }
`;
