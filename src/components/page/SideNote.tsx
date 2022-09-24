import React from 'react';
import { css, cx } from '@emotion/css';

export default function SideNote(props: Props) {
  const width = props.width??200;
  const direction = props.direction??'down';

  return (
    <span className={cx("tooltip", rootCss)}>
      <span className={cx("arrow", direction)}/>
      <span
        className={cx("info", direction)}
        style={{
          width,
          height: props.height,
          marginLeft: -width/ 2,
        }}
      >
        {props.children}
      </span>
    </span>
  );
}

interface Props extends React.PropsWithChildren<{}> {
  width?: number;
  height?: number;
  direction?: 'down' | 'left';
}

// 🚧 remove?
const vertOffsetPx = 20;

const rootCss = css`
  display: inline-block;
  cursor: pointer;
  position: relative;
  font-size: 0.96rem;
  font-style: normal;
  text-align: center;

  width: 24px;
  height: 16px;
  margin-left: 4px;
  border-radius: 10px;
  border: 2px solid #777;
  background: black;

  :hover {
    animation-play-state: paused;
    -webkit-animation-play-state: paused;
    .arrow, .info {
      visibility: visible;
    }
  }

  .info {
    position: absolute;
    width: 200px;
    padding: 8px 2px;
    background: white;
    color: #000;
    border-radius: 3px;
    line-height: 1.8;
    visibility: hidden;

    &.down {
      top: ${vertOffsetPx}px;
    }
    &.left {
      top: -16px;
      left: ${-(100 + 8)}px;
    }
  }

  .arrow {
    position: absolute;
    z-index: 1;
    width: 0; 
    height: 0;
    visibility: hidden;
    
    &.down {
      top: calc(-10px + ${vertOffsetPx}px);
      left: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 10px solid white;
    }
    &.left {
      top: -4px;
      left: -8px;
      border-top: 10px solid transparent;
      border-bottom: 10px solid transparent;
      border-left: 10px solid white;
    }
  }
`;
