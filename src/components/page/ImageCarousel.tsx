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
  peekWidth?: number | string;
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
    font-size: 24px;
    font-family: Monaco;
    font-weight: 300;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid #444;
    padding: 16px;
    text-transform: lowercase;
  }
`;
