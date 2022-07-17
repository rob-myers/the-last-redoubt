import React from "react";
import { css, cx } from '@emotion/css';
import { iconCss } from './Icons';
import Link from './Link';
import { cssName } from "projects/service/const";

export function TabsOverlay(props: Props) {
  return (
    <div className={controlsCss}>
      <div className={cssName.topRight}>
        <div
          className={cx(
            cssName.resetIcon,
            iconCss({ basename: 'refresh', dim: 11, invert: true }),
            !props.enabled && cssName.disabled,
          )}
          onClick={props.reset}
          title="reset"
        />
        <Link
          href={`#${props.parentTabsId}`}
          className={iconCss({ basename: 'hash-icon', dim: 11, invert: true })}
          title="anchor"
        />
        <div
          className={iconCss({ basename: props.expanded ? 'compress' : 'expand', dim: 11, invert: true })}
          onClick={props.toggleExpand}
          title={props.expanded ? 'minimise' : 'maximise'}
        />
        <div
          className={cx(
            cssName.disableIcon,
            iconCss({ basename: 'cross-circle', dim: 11, invert: true }),
            !props.enabled && cssName.disabled,
          )}
          onClick={props.toggleEnabled}
        />
      </div>
      {!props.enabled && (
        <div className={cssName.central} onClick={props.toggleEnabled}>
          interact
        </div>
      )}
    </div>
  );
}

interface Props {
  enabled: boolean;
  expanded: boolean;
  parentTabsId: string;
  reset(): void;
  toggleExpand(): void;
  toggleEnabled(): void;
}

const controlsCss = css`
  font-family: Roboto, Arial, sans-serif;

  > .${cssName.topRight} {
    position: absolute;
    right: calc(-1 * var(--tabs-border-width));
    top: -38px;
    z-index: 2;
    height: 38px;

    background: #444;
    border-bottom-width: 0;

    padding: 0px 8px;
    @media(max-width: 600px) {
      padding: 0 8px 2px 8px;
    }
    
    display: flex;
    line-height: initial;
    align-items: center;
    > * {
      padding: 0 8px;
      height: 100%;
      display: flex;
      align-items: center;
    }
    cursor: pointer;
    
    > div.disabled {
      filter: brightness(50%);
      pointer-events: none;
    }
  }

  > .${cssName.central} {
    position: absolute;
    z-index: 6;
    left: calc(50% - (128px / 2));
    top: calc(50% - 20px);
    
    cursor: pointer;
    color: #ddd;
    background: rgba(0, 0, 0, 0.9);
    padding: 12px 32px;
    border-radius: 4px;
    border: 1px solid #ddd;
    font-size: 1.2rem;
    letter-spacing: 2px;
  }
`;

export function LoadingOverlay({ colour }: {
  colour: 'black' | 'faded' | 'clear';
}) {
  return (
    <div
      className={cx(interactOverlayCss, {
        [cssName.clear]: colour === 'clear',
        [cssName.faded]: colour === 'faded',
      })}
    />
  );
}

const interactOverlayCss = css`
  &:not(.${cssName.faded}) {
    pointer-events: none;
  }

  position: absolute;
  z-index: 4;
  width: 100%;
  height: 100%;
  background: #000;
  font-family: sans-serif;

  opacity: 1;
  transition: opacity 1s ease-in;
  &.${cssName.clear} {
    opacity: 0;
    transition: opacity 0.5s ease-in;
  }
  &.${cssName.faded} {
    opacity: 0.5;
    transition: opacity 0.5s ease-in;
  }
`;
