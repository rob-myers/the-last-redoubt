import React from 'react';
import { css, cx } from '@emotion/css';
import Link from './Link';

/**
 * https://css-tricks.com/css-only-carousel/
 */
export default function Carousel(props: Props) {

  const items = React.Children.toArray(props.children);

  return (
    <div className={cx("carousel", rootCss)}>

      {items.map((_item, i) => (
        <Link
          key={i}
          href={`#${props.id}-slide-${i + 1}`}
          // Native navigate for horizontal scroll
          postPush={() => location.href = `#${props.id}-slide-${i + 1}`}
        >
          {i + 1}
        </Link>
      ))}

      <div className="slides" style={{ height: props.height + 20 }}>
        {items.map((item, i) => (
          <div>
            <div className="anchor" id={`${props.id}-slide-${i + 1}`} />
            {item}
          </div>
        ))}
      </div>

    </div>
  );
}

type Props = React.PropsWithChildren<{
  id: string;
  height: number;
}>;

const rootCss = css`
  width: 100%;
  text-align: center;
  overflow: hidden;
  background-color: #222;

  > a {
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    color: white;
    background: black;
    text-decoration: none;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    margin: 0 0 0.5rem 0;
    position: relative; 
  }
  > a:active {
    top: 1px;
  }
  > a:focus {
    background: #000;
  }
  > a:not(:last-child) {
    margin-right: 4px;
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
  }
  .slides::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  .slides::-webkit-scrollbar-thumb {
    background: black;
    border-radius: 10px;
  }
  .slides::-webkit-scrollbar-track {
    background: transparent;
  }
  .slides > div {
    scroll-snap-align: start;
    flex-shrink: 0;
    width: 100%;
    margin-right: 50px;
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
`;

