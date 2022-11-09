import React from 'react';
import { css, cx } from '@emotion/css';

/**
 * - Direction is `right` unless < 200 pixels to the right of
 *   root element, in which case direction is `left`
 * - Currently .dark-mode applies `filter: invert(1)`
 */
export default function SideNote(props: React.PropsWithChildren<{
  width?: number;
}>) {
  return (
    <span
      className={cx("side-note", rootCss)}
      onClick={e => open(e, props.width)}
      onMouseEnter={e => open(e, props.width)}
      onMouseLeave={close} // Triggered on mobile click outside
    >
      ?
      <span className="arrow"/>
      <span className="info">
        {props.children}
      </span>
    </span>
  );
}

function open(e: React.MouseEvent, width?: number) {
  const root = e.currentTarget as HTMLElement;
  root.classList.add('open');
  const rect = root.getBoundingClientRect();
  const pixelsOnRight = document.documentElement.clientWidth - (rect.x + rect.width);
  root.classList.add(pixelsOnRight < infoWidthPx ? 'left' : 'right');
  width && root.style.setProperty('--info-width', `${width}px`);
}
function close(e: React.MouseEvent) {
  const root = e.currentTarget as HTMLElement;
  root.classList.remove('open', 'left', 'right', 'down');
  root.style.removeProperty('--info-width');
}

const infoWidthPx = 240;
const rootWidthPx = 16;
const arrowDeltaX = 4;

const rootCss = css`
  --info-width: 240px;

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
  background-color: #eee;
  color: black;
  
  &.open .arrow,
  &.open .info
  {
    visibility: visible;
  }
  
  position: relative;
  /** Over InlineCode */
  z-index: 1;
  top: -2px;

  .info {
    white-space: normal;
    position: absolute;
    /* width: ${infoWidthPx}px; */
    width: var(--info-width);
    /* margin-left: -${infoWidthPx / 2}px; */
    margin-left: calc(-0.5 * var(--info-width));
    padding: 16px;
    background-color: black;
    color: white;
    border-radius: 4px;
    line-height: 1.6;
    visibility: hidden;
    a {
      color: #dd0;
    }
    code {
      font-size: inherit;
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
      /* left: ${-(infoWidthPx/2 + arrowDeltaX)}px; */
      left: calc(-1 * (0.5 * var(--info-width) + ${arrowDeltaX}px ));
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
      /* left: ${rootWidthPx + infoWidthPx/2 + arrowDeltaX}px; */
      left: calc(${rootWidthPx}px + 0.5 * var(--info-width) + ${arrowDeltaX}px);
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
