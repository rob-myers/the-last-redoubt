import React from 'react';
import { css, cx } from '@emotion/css';

/**
 * - Direction is `left` unless < 200 pixels to the left of
 *   root element, in which case direction is `right`
 * - Currently .dark-mode applies `filter: invert(1)`
 */
export default function SideNote(props: Props) {
  return (
    <div
      className={cx("side-note", rootCss)}
      onMouseEnter={e => {
        const root = e.currentTarget;
        root.classList.add('open');
        const { x } = root.getBoundingClientRect();
        root.classList.add(x < 200 ? 'right' : 'left');
      }}
      onMouseLeave={e => {
        e.currentTarget.classList.remove('open', 'left', 'right', 'down');
      }}
    >
      <span className={cx("arrow")}/>
      <span className={cx("info")}>
        {props.children}
      </span>
    </div>
  );
}

interface Props extends React.PropsWithChildren<{}> {
  direction?: 'down' | 'left' | 'right';
}

const rootCss = css`
  display: inline-block;
  font-style: normal;
  text-align: center;
  cursor: pointer;
  
  width: 16px;
  height: 16px;
  border-radius: 10px;
  border: 2px solid #777;
  background-color: rgba(0, 0, 0, 0);
  
  &.open .arrow,
  &.open .info
  {
    visibility: visible;
  }
  
  position: relative;
  .info {
    position: absolute;
    width: 200px;
    margin-left: -100px;
    padding: 16px;
    background-color: black;
    color: white;
    border-radius: 6px;
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
      left: ${-(100 + 6)}px;
    }
    .arrow {
      top: -4px;
      left: -8px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 10px solid black;
    }
  }
  &.right {
    .info {
      top: -16px;
      left: ${100 + 18}px;
    }
    .arrow {
      top: -4px;
      left: 8px;
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
