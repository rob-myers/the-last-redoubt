import React from "react";
import { css } from "@emotion/css";
import Carousel from "./Carousel";

export default function ImageCarousel(props: Props) {
  return (
    <Carousel
      id="intro-video-frames"
      width={props.width}
      height={props.height}
      className={rootCss}
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
          />
        </div>
      )}
    </Carousel>
  );
}

interface Props {
  id: string;
  width: number | string;
  height: number | string;
  baseSrc?: string;
  items: {
    src: string;
    label?: string;
  }[];
  imgStyles?: React.CSSProperties;
  labelTop?: string;
}

const rootCss = css`
  .slide-container {
    border-radius: 16px 16px 0 0;
    border: 1px solid #bbb;
    border-bottom-width: 0;
  }
  .slides::-webkit-scrollbar-track {
    border: 1px solid #bbb;
    border-width: 0 1px;
  }
  .slide {
    height: 100%;
    overflow: hidden;
    position: relative;
  }
  .slide-label {
    position: absolute;
    /* top: 10%; */
    color: white;
    font-size: 28px;
    font-family: Monaco;
    font-weight: 300;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid #888;
    padding: 16px 4px;
    text-transform: lowercase;
  }
`;
