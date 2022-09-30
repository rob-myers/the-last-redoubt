import React from 'react';
import { css, cx } from '@emotion/css';

/**
 * - Direction is `right` unless < 200 pixels to the right of
 *   root element, in which case direction is `left`
 * - Currently .dark-mode applies `filter: invert(1)`
 */
export default function SideNote(props: React.PropsWithChildren<{}>) {
  return (
    <span
      className={cx("side-note", rootCss)}
      onClick={open}
      onMouseEnter={open}
      onMouseLeave={close} // Triggered on mobile click outside
    >
      ?
      <span className={cx("arrow")}/>
      <span className={cx("info")}>
        {props.children}
      </span>
    </span>
  );
}

function open(e: React.MouseEvent) {
  const root = e.currentTarget;
  root.classList.add('open');
  const rect = root.getBoundingClientRect();
  const pixelsOnRight = document.documentElement.clientWidth - (rect.x + rect.width);
  root.classList.add(pixelsOnRight < infoWidthPx ? 'left' : 'right');
}
function close(e: React.MouseEvent) {
  e.currentTarget.classList.remove('open', 'left', 'right', 'down');
}

const infoWidthPx = 200;
const rootWidthPx = 16;
const arrowDeltaX = 4;

const rootCss = css`
  font-size: 0.95rem;
  font-style: normal;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
  
  width: ${rootWidthPx}px;
  padding: 0 4px;
  margin: 0 3px 0 2px;
  border-radius: 10px;
  border: 1px solid #444;
  background-color: #ddd;
  color: black;
  
  &.open .arrow,
  &.open .info
  {
    visibility: visible;
  }
  
  position: relative;
  z-index: 1; /** Over InlineCode */

  .info {
    white-space: normal;
    position: absolute;
    width: ${infoWidthPx}px;
    margin-left: -${infoWidthPx / 2}px;
    padding: 16px;
    background-color: black;
    color: white;
    border-radius: 4px;
    line-height: 1.6;
    visibility: hidden;
    a {
      color: #dd0;
    }
  }
  .arrow {
    position: absolute;
    z-index: 1;
    width: 0; 
    height: 0;
    visibility: hidden;
  }

  &.left {
    .info {
      top: -16px;
      left: ${-(infoWidthPx/2 + arrowDeltaX)}px;
    }
    .arrow {
      top: 0;
      left: -${arrowDeltaX}px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 10px solid black;
    }
  }
  &.right {
    .info {
      top: -16px;
      left: ${rootWidthPx + infoWidthPx/2 + arrowDeltaX}px;
    }
    .arrow {
      top: 0;
      left: ${rootWidthPx/2 + arrowDeltaX}px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-right: 10px solid black;
    }
  }
  &.down {
    .info {
      top: 20px;
    }
    .arrow {
      top: calc(-10px + 20px);
      left: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 10px solid black;
    }
  }
  
`;
