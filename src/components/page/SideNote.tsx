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
  const timeoutId = React.useRef(0);

  return <>
    <span
      className={cx("side-note", iconTriggerCss)}
      onClick={e => open(e, props.width, timeoutId.current)}
      onMouseEnter={e => open(e, props.width, timeoutId.current)}
      onMouseLeave={e => (timeoutId.current = close(e, 'icon'))}
    >
      ?
    </span>
    <span
      className={cx("side-note-bubble", speechBubbleCss)}
      onMouseEnter={_ => window.clearTimeout(timeoutId.current)}
      onMouseLeave={e => (timeoutId.current = close(e, 'bubble'))} // Triggered on mobile click outside
    >
      <span className="arrow"/>
      <span className="info">
        {props.children}
      </span>
    </span>
  </>;
}

function open(e: React.MouseEvent, width: number | undefined, timeoutId: number) {
  window.clearTimeout(timeoutId);

  const bubble = e.currentTarget.nextSibling as HTMLElement;
  bubble.classList.add('open');
  
  // 🚧 consider favouring bubble on right
  const rect = bubble.getBoundingClientRect();
  const pixelsOnRight = document.documentElement.clientWidth - (rect.x + rect.width) - 40;
  const pixelsOnLeft = rect.x;
  const maxWidthAvailable = Math.max(pixelsOnLeft, pixelsOnRight);
  bubble.classList.remove('left', 'right', 'down');
  bubble.classList.add(pixelsOnRight < pixelsOnLeft ? 'left' : 'right');
  
  if (maxWidthAvailable < (width??defaultInfoWidthPx)) {
    width = maxWidthAvailable;
  }
  width && bubble.style.setProperty('--info-width', `${width}px`);
}

function close(e: React.MouseEvent, source: 'icon' | 'bubble') {
  const bubble = (source === 'icon' ? e.currentTarget.nextSibling : e.currentTarget) as HTMLElement;
  return window.setTimeout(() => {
    bubble.classList.remove('open', 'left', 'right', 'down');
    bubble.style.removeProperty('--info-width');
  }, 100);
}

const defaultInfoWidthPx = 240;
const rootWidthPx = 16;
const arrowDeltaX = 4;

const iconTriggerCss = css`
  position: relative;
  top: -2px;

  width: ${rootWidthPx}px;
  padding: 0 4px;
  margin: 0 3px 0 5px;
  
  border-radius: 10px;
  border: 1px solid #444;
  background-color: #eee;
  color: black;
  font-size: 0.95rem;
  font-style: normal;
  cursor: pointer;
  white-space: nowrap;
`;

const speechBubbleCss = css`
  --info-width: ${defaultInfoWidthPx}px;
  position: relative;
  z-index: 2;
  top: -4px;

  font-size: 0.95rem;
  font-style: normal;
  text-align: center;
  cursor: pointer;
  white-space: nowrap;

  &.open .arrow,
  &.open .info
  {
    visibility: visible;
  }
  .info {
    visibility: hidden;
    white-space: normal;
    position: absolute;
    width: var(--info-width);
    margin-left: calc(-0.5 * var(--info-width));
    padding: 16px;
    background-color: black;
    color: white;
    border-radius: 4px;
    line-height: 1.6;
    a {
      color: #dd0;
    }
    code {
      font-size: inherit;
    }
  }
  .arrow {
    visibility: hidden;
    position: absolute;
    z-index: 1;
    width: 0; 
    height: 0;
  }

  &.left {
    left: ${-1.5 * rootWidthPx}px;
    .info {
      top: -16px;
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
    left: ${-rootWidthPx}px;
    .info {
      top: -16px;
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