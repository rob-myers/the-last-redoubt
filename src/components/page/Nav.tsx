import React from "react";
import { css, cx } from "@emotion/css";

import useSiteStore from "store/site.store";
import { cssName, zIndex } from 'projects/service/const';
import type { FrontMatterProps } from "./Root";
import NavItems from './NavItems';

export default function Nav({ frontmatter }: FrontMatterProps) {

  const navOpen = useSiteStore(x => x.navOpen);
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !(e.target instanceof HTMLAnchorElement)
      && window.matchMedia('(max-width: 1400px)').matches
    ) {
      useSiteStore.setState({ navOpen: !navOpen }, undefined, navOpen ? 'open-nav' : 'close-nav');
    }
  };

  return (
    <>
      <nav
        className={cx(
          cssName.navMain,
          navCss,
          navOpen ? cssName.navMainOpen : cssName.navMainClosed,
        )}
        onClick={onClick}
      >
        <div
          className="article-overlay"
        />
        <div className={cssName.topBarHandle}>
          <div className="nav-arrow">
            {navOpen ? '<' : '>'}
          </div>
        </div>
        <NavItems
          frontmatter={frontmatter}
        />
      </nav>

      <div
        className={cx(cssName.topBar,topBarCss)}
        onClick={onClick}
      />

      <div
        className={cx(
          'horizontal-fill',
          horizFillCss,
          navOpen && 'open',
        )}
      />
    </>
  );
}

const sidebarWidth = 256;
const handleWidth = 40;
export const barHeight = 40;

const navCss = css`
  position: fixed;
  z-index: ${zIndex.nav};
  height: calc(100% + 200px);
  width: ${sidebarWidth}px;

  font-weight: 300;
  font-family: sans-serif;
  background: var(--nav-background);
  color: white;
  cursor: pointer;
  opacity: 0.975;
  /** https://stackoverflow.com/questions/21003535/anyway-to-prevent-the-blue-highlighting-of-elements-in-chrome-when-clicking-quic  */
  -webkit-tap-highlight-color: transparent;
  
  left: 0;
  transition: transform 500ms ease;
  &.open {
    transform: translateX(0px);
  }
  /** Cannot close nav when width > 1400px */
  @media(max-width: 1450px) {
    &.closed {
      transform: translateX(-${sidebarWidth}px);
    }
  }

  > .article-overlay {
    position: absolute;
    top: 0;
    left: ${sidebarWidth}px;
    width: 100vw;
    height: 0;
    background: rgba(0, 0, 0, .5);
  }
  @media(max-width: 1280px) {
    &.open > .article-overlay {
      height: 100%;
    }
  }

  > .handle {
    position: absolute;
    top: -1px;
    right: -${handleWidth}px;
    width: ${handleWidth}px;
    height: ${barHeight + 1}px;

    display: flex;
    justify-content: center;
    align-items: center;
    user-select: none;
    
    .nav-arrow {
      display: flex;
      justify-content: center;
      align-items: center;
      background: #900;
      color: #fff;
      width: inherit;
      height: inherit;
      padding: 0 0 2px 0;
    }

    animation: fadeInHandle ease-in 500ms forwards;
    @keyframes fadeInHandle {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
  }
`;

const topBarCss = css`
  position: fixed;
  cursor: pointer;
  z-index: ${zIndex.navTopBar};
  left: 0;
  width: calc(100vw + ${sidebarWidth}px);
  height: ${barHeight}px;
  background: #222;

  animation: fadeInTopBar ease-in 300ms forwards;
  @keyframes fadeInTopBar {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
`;

const horizFillCss = css`
  transition: min-width 800ms ease;

  min-width: 0;
  &.open {
    min-width: ${sidebarWidth}px;
  }
  @media(max-width: 1024px) {
    display: none;
  }
  @media(min-width: 1450px) {
    min-width: ${sidebarWidth}px;
  }
`;
