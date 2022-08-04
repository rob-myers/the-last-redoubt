import React from 'react';
import { css, cx } from '@emotion/css';

/**
 * https://css-tricks.com/css-only-carousel/
 */
export default function Carousel(props: Props) {

  const items = React.Children.toArray(props.children);

  return (
    <div className={cx("carousel", carouselRootCss, props.className)}>
      <div className="slides" style={{ width: props.width, height: props.height }}>
        {items.map((item, i) => (
          <div
            key={i}
            className="slide-container"
            style={{ width: props.width }}
          >
            {/* <div
              className="anchor"
              id={`${props.id}-slide-${i + 1}`}
            /> */}
            {
              item // The slide
            }
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = React.PropsWithChildren<{
  id: string;
  width: number | string;
  height: number | string;
  className?: string;
}>;

const carouselRootCss = css`
  text-align: center;
  overflow: hidden;
  width: 100%;
  display: flex;
  justify-content: center;
  background-color: #222;
  border-radius: 10px;

  > a {
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    color: black;
    background: white;
    text-decoration: none;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    margin: 8px 4px 8px 0;
    position: relative; 
  }

  .slides {
    display: flex;
    
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    
    position: relative;
    > div > div.anchor {
      position: absolute;
      top: -100px;
    }

    /** Separate scrollbar */
    /* padding-bottom: 10px; */
  }
  .slides::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .slides::-webkit-scrollbar-thumb {
    background: #777;
  }
  .slides::-webkit-scrollbar-track {
    background: transparent;
  }
  .slides > div {
    scroll-snap-align: start;
    flex-shrink: 0;
    background: #eee;
    transform-origin: center center;
    transform: scale(1);
    transition: transform 0.5s;
    position: relative;
    
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 100px;
    background-color: #000;
  }
  .slides > div:not(:last-child) {
    /** Needed, otherwise scrolling breaks */
    margin-right: 12px;
  }
`;

export function ImageCarousel(props: ImageCarouselProps) {
  return (
    <Carousel
      id="intro-video-frames"
      width={props.width}
      height={props.height}
      className={imageCarouselRootCss}
    >
      {props.items.map(({ src, label }) =>
        <div className="slide">
          {label && (
            <div className="slide-label">
              {label}
            </div>
          )}
          <img
            key={src}
            src={`${props.baseSrc || ''}${src}`}
            style={props.imgStyles}
          />
        </div>
      )}
    </Carousel>
  );
}

interface ImageCarouselProps {
  id: string;
  width: number | string;
  height: number | string;
  baseSrc?: string;
  items: {
    src: string;
    label?: string;
  }[];
  imgStyles?: React.CSSProperties;
}

const imageCarouselRootCss = css`
  .slide {
    height:100%;
    overflow:hidden;
    position: relative;
  }
  .slide-label {
    position: absolute;
    top: 8%;
    color: white;
    line-height: 1;
    font-size: 32px;
    font-family: Monaco;
    font-weight: 300;
    background: rgba(0, 0, 0, 0.4);
    padding: 8px 4px;
    text-transform: lowercase;
  }
`;
