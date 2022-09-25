import React from 'react';
import { css, cx } from '@emotion/css';

/**
 * 🚧 check if there's space for direction 'right' on hover
 */
export default function SideNote(props: Props) {
  const direction = props.direction??'left';
  return (
    <div className={cx("side-note", rootCss)}>
      <span className={cx("arrow", direction)}/>
      <span className={cx("info", direction)}>
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
  position: absolute;
  right: 8px;
  /* margin-top: 6px; */

  font-style: normal;
  text-align: center;
  cursor: pointer;

  width: 16px;
  height: 16px;
  border-radius: 10px;
  border: 2px solid #777;
  background-color: rgba(0, 0, 0, 0);

  &:hover, &:active {
    animation-play-state: paused;
    -webkit-animation-play-state: paused;
    .arrow, .info {
      visibility: visible;
    }
  }

  .info {
    position: absolute;
    width: 200px;
    margin-left: -100px;
    padding: 16px 2px;
    background-color: black;
    color: white;
    border-radius: 6px;
    line-height: 1.6;
    visibility: hidden;

    &.down {
      top: 20px;
    }
    &.left {
      top: -16px;
      left: ${-(100 + 6)}px;
    }
    &.right {
      top: -16px;
      left: ${100 + 18}px;
    }
  }

  .arrow {
    position: absolute;
    z-index: 1;
    width: 0; 
    height: 0;
    visibility: hidden;
    
    &.down {
      top: calc(-10px + 20px);
      left: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 10px solid black;
    }
    &.left {
      top: -4px;
      left: -8px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 10px solid black;
    }
    &.right {
      top: -4px;
      left: 8px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-right: 10px solid black;
    }
  }
`;
