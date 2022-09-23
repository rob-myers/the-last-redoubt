import React from 'react';
import { css } from '@emotion/css';

/**
 * TODO 🚧 support mobile e.g. via custom tooltip
 */
export default function SideNote(props: Props) {
  const width = props.width??200;
  return (
    <div className={rootCss}>
      <div className="arrow"/>
      <div
        className="info"
        style={{
          width,
          height: props.height,
          marginLeft: -width/ 2,
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

interface Props extends React.PropsWithChildren<{}> {
  width?: number;
  height?: number;
}

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
      visibility:visible;
    }
  }

  .info {
    position:absolute;
    top: ${vertOffsetPx}px;
    width: 200px;
    padding: 2px;
    background: black;
    color: #ccc;
    border-radius: 3px;
    border: thick var(--page-border-color) solid;
    visibility: hidden;
  }

  .arrow {
    position: absolute;
    z-index: 1;
    top: calc(-10px + ${vertOffsetPx}px);
    left: 0;
    /* margin: -10px 0 0 -5px; */
    width: 0; 
    height: 0; 
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-bottom: 10px solid var(--page-border-color);
    visibility: hidden;
  }
`;
