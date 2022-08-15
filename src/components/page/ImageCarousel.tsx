import React from "react";
import { css, cx } from "@emotion/css";
import Carousel, { BaseProps as CarouselProps } from "./Carousel";

export default function ImageCarousel(props: Props) {
  return (
    <Carousel
      id="intro-video-frames"
      width={props.width}
      height={props.height}
      className={cx(
        props.className,
        rootCss,
        props.blur ? blurCss : undefined,
      )}
      peekWidth={props.peekWidth}
    >
      {props.items.map(({ src, label }) =>
        <div key={src} className="slide">
          {label && (
            <div
              className="slide-label"
              style={{ top: props.labelTop }}
            >
              {label}
            </div>
          )}
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
  items: { src: string; label?: string; }[];
  baseSrc?: string;

  blur?: boolean;
  imgStyles?: React.CSSProperties;
  labelTop?: string;
}

const rootCss = css`
  .slide-container {
    border-radius: 8px 8px 0 0;
    border-width: 8px 0 0 0;
    border: 1px solid #555;
  }
  .slides::-webkit-scrollbar-track {
    border: 0 solid #777;
  }
  .slide {
    height: 100%;
    overflow: hidden;
    /* border: 1px solid #555; */
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
  }
`;

const blurCss = css`
  .slide {
    filter: blur(1.5px);
    transition: filter 300ms ease-in-out;
    &:hover, &:focus {
      filter: blur(0px);
    }
  }
`;