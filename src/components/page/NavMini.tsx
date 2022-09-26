import { Link } from "gatsby";
import React from "react";
import { css, cx } from "@emotion/css";
import useSiteStore from "store/site.store";
import { cssName, zIndex } from 'projects/service/const';
import { barHeight } from "./Nav";
import Icon from "./Icon";

export default function NavMini() {

  const { meta, prev, next } = useSiteStore(
    x => {
      const meta = x.articleKey ? x.articlesMeta[x.articleKey] : null;
      const prev = meta?.prev ? x.articlesMeta[meta.prev] : null;
      const next = meta?.next ? x.articlesMeta[meta.next] : null;
      return { meta, prev, next };
    },
    (a, b) => a.meta?.key === b.meta?.key,
  );

  return (
    <div className={rootCss}>
      <nav className={cssName.navMini}>
        <ul>
          {meta && (meta.navGroup !== null) && <>
            <li>
              <Link to={prev?.path || meta.path}>
                <span className="prev">prev</span>
              </Link>
            </li>
            <li>
              <Link to={meta.path}>
                <span className="primary">id</span>
              </Link>
            </li>
            <li>
              <Link to={next?.path || meta.path}>
                <span className="next">next</span>
              </Link>
            </li>
          </>}
        </ul>
        <Icon
          icon="light-bulb"
          className={cx("toggle-dark-mode", cssName.ignoreDark)}
          invert
          small
          onClick={useSiteStore.api.toggleDarkMode}
        />
      </nav>
    </div>
  );
  
}

const controlsWidthPx = 150;
const darkToggleWidthPx = 36;

const rootCss = css`
  position: absolute;
  right: ${controlsWidthPx + darkToggleWidthPx}px;
  top: -32px;
  @media(max-width: 600px) {
    top: 0;
  }
  z-index: ${zIndex.navMini};
  
  nav {
    position: fixed;
    display: flex;
  }

  nav ul {
    width: ${controlsWidthPx}px;
    height: ${barHeight}px;

    display: flex;
    align-items: stretch;
    padding: 0;
    margin: 0;

    li {
      flex: 1;
      display: flex;
      list-style: none;
      list-style-position: inside;
    }
    a {
      flex: 1;
      color: #ccc;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 0 solid #555;
      border-left-width: 1px;
      font-size: 1rem;
      font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    }
    a.primary {
      color: #fff;
    }
  }

  nav .toggle-dark-mode {
    background-color: #444;
    width: ${darkToggleWidthPx}px;
    right: ${5}px;
    height: ${barHeight}px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
`;
