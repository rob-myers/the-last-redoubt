import React from 'react';
import { css, cx } from '@emotion/css';
import { parseCssDim } from 'projects/service/dom';

/**
 * https://css-tricks.com/css-only-carousel/
 */
export default function Carousel(props: React.PropsWithChildren<BaseProps>) {

  const items = React.Children.toArray(props.children);

  return (
    <div className={cx("carousel", rootCss, props.className)}>
      <div
        className="slides"
        style={{
          // width: `calc(${parseCssDim(props.width)} + ${parseCssDim(props.peekWidth)})`,
          width: '100%',
          height: props.height,
          scrollPaddingLeft: `calc(0.5 * ${parseCssDim(props.peekWidth)})`,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="slide-container"
            style={{ width: props.width }}
          >
            {
              item // The slide
            }

            <div className="slide-index">
              {i + 1}
              <span className="of">
                /
              </span>
              {items.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface BaseProps {
  id: string;
  width: number | string;
  height: number | string;
  /** To reveal the next slide */
  peekWidth?: number | string;
  className?: string;
}

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
    position: relative;
    
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;

    scroll-padding-left: 30px;
  }
  .slide-container > .slide-index {
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    padding: 8px 12px;

    color: white;
    font-size: 16px;
    background-color: rgba(0, 0, 0, 0.75);
    border: 1px solid #777;
    border-radius: 4px 0 0 4px;
    border-right-width: 0;

    .of {
      color: #aaa;
      margin: 0 2px;
    }
  }

  .slides::-webkit-scrollbar {
    width: 10px;
    height: 10px;
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
    
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 100px;
    background-color: #000;
    /**
     * - Separates slides
     * - May be important for scroll-into-view to work
     */
    margin-right: 12px;
  }
  .slides > div:last-child {
    /** No final slide peek beyond (use extraWidth instead) */
    margin-right: 0;
  }
`;
