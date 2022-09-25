import React from 'react';
import { css, cx } from '@emotion/css';

export default function SideNote(props: Props) {
  const width = props.width??200;
  const direction = props.direction??'left';

  return (
    <div className={cx("side-note", rootCss)}>
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
    </div>
  );
}

interface Props extends React.PropsWithChildren<{}> {
  width?: number;
  height?: number;
  direction?: 'down' | 'left';
}

const rootCss = css`
  display: inline-block;
  @media (max-width: 800px) {
    position: absolute;
    right: 8px;
    /* margin-top: 6px; */
  }

  font-style: normal;
  text-align: center;
  cursor: pointer;

  width: 16px;
  height: 16px;
  border-radius: 10px;
  border: 2px solid #777;

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
    background: black;
    color: white;
    border-radius: 3px;
    line-height: 1.8;
    visibility: hidden;

    &.down {
      top: 20px;
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
  }
`;
