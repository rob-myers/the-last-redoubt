import React from 'react';
import { css, cx } from '@emotion/css';

/**
 * https://css-tricks.com/css-only-carousel/
 */
export default function ImageCarousel(props: Props) {

  const items = React.Children.toArray(props.children);

  return (
    <div className={cx("carousel", rootCss, props.className)}>
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
            {item /** The slide */}
            <div className="slide-index">
              {i + 1}
              <span className="of">
                /
              </span> {items.length}
            </div>
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

const rootCss = css`
  text-align: center;
  overflow: hidden;
  width: 100%;
  display: flex;
  justify-content: center;
  line-height: 1.4;
  padding: 16px 16px 0 16px;

  .slides {
    display: flex;
    
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
    
    // Separate scrollbar
    /* padding-bottom: 10px; */
  }
  /* .slide-container > .anchor {
    position: absolute;
    top: -100px;
  } */
  .slide-container > .slide-index {
    position: absolute;
    right: -8px;
    display: flex;
    align-items: center;
    padding: 8px 12px;

    color: white;
    font-size: 16px;
    background-color: rgba(0, 0, 0, 0.75);
    border: 1px solid #888;
    border-radius: 4px;

    .of {
      color: #aaa;
      margin: 0 2px;
    }
  }

  .slides::-webkit-scrollbar {
    width: 10px;
    height: 20px;
  }
  .slides::-webkit-scrollbar-thumb {
    background: #777;
  }
  .slides::-webkit-scrollbar-track {
    background: black;
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
  .slides > div {
    /**
     * - Separate slides
     * - Final slide peek beyond
     * - May also be important for scroll into view
     */
    margin-right: 12px;
  }
  .slides > div:first-child {
    /** Initial slide peek before */
    margin-left: 12px;
  }
`;
