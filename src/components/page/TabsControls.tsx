import { Link } from "gatsby";
import React from "react";
import { css, cx } from '@emotion/css';
import { cssName, zIndex } from "projects/service/const";
import type { State } from "./Tabs";
import Icon from "./Icon";

export function TabsControls({ api, tabsId }: Props) {
  return (
    <div className={controlsCss}>

      <div className={cssName.topRight}>
        <Icon
          icon="refresh"
          small
          invert
          onClick={api.reset}
          title="reset"
          className={cx(
            api.resetDisabled ? cssName.disabled : undefined,
            cssName.ignoreDark,
          )}
        />
        <Link to={`#${tabsId}`}>
          <Icon
            icon="hash-icon"
            small
            invert
            title="anchor"
            className={cssName.ignoreDark}
          /> 
        </Link>
        <Icon
          icon={api.expanded ? "compress" : "expand"}
          small
          invert
          onClick={api.toggleExpand}
          title={api.expanded ? 'minimise' : 'maximise'}
          className={cssName.ignoreDark}
        />
        <Icon
          icon="cross-circle"
          small
          invert
          onClick={api.toggleEnabled}
          className={cx(
            !api.enabled ? cssName.disabled : undefined,
            cssName.ignoreDark,
          )}
        />
      </div>

      {!api.enabled && (
        <div
          className={cssName.central}
          onClick={api.toggleEnabled}
        >
          interact
        </div>
      )}

    </div>
  );
}

interface Props {
  api: State;
  tabsId: string;
}

const controlsCss = css`
  font-family: Roboto, Arial, sans-serif;

  > .${cssName.topRight} {
    position: absolute;
    right: calc(-1 * var(--tabs-border-width));
    top: -38px;
    z-index: ${zIndex.tabsTopRightButtons};
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
    span, a span {
      padding: 0 8px;
      @media(max-width: 600px) {
        padding: 2px 12px;
      }
      height: 100%;
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    
    /** Move to Icon */
    > .disabled {
      filter: brightness(50%);
      pointer-events: none;
    }
  }

  > .${cssName.central} {
    position: absolute;
    z-index: ${zIndex.tabsCentralButton};
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

export function FaderOverlay({ colour }: {
  colour: 'black' | 'faded' | 'clear';
}) {
  return (
    <div
      className={cx(faderOverlayCss, {
        [cssName.clear]: colour === 'clear',
        [cssName.faded]: colour === 'faded',
      })}
    />
  );
}

const faderOverlayCss = css`
  position: absolute;
  z-index: ${zIndex.tabsFaderOverlay};
  width: 100%;
  height: 100%;
  background: #000;
  font-family: sans-serif;

  &:not(.${cssName.faded}) {
    pointer-events: none;
  }

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
