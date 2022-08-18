import { Link } from "gatsby";
import React from "react";
import { css } from "@emotion/css";
import { tryLocalStorageSet } from "projects/service/generic";
import useSiteStore from "store/site.store";
import { cssName, localStorageKey, zIndex } from 'projects/service/const';
import { barHeight } from "./Nav";
import Icon from "./Icon";

export default function NavMini() {

  const { meta, prev, next } = useSiteStore(x => {
    const meta = x.articleKey ? x.articlesMeta[x.articleKey] : null;
    const prev = meta?.prev ? x.articlesMeta[meta.prev] : null;
    const next = meta?.next ? x.articlesMeta[meta.next] : null;
    return { meta, prev, next };
  }, (a, b) => a.meta?.key === b.meta?.key);

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
          className="toggle-dark-mode"
          invert
          onClick={(e) => {
            const enabled = document.body.classList.toggle('dark-mode');
            tryLocalStorageSet(localStorageKey.darkModeEnabled, `${enabled}`);
          }}
        />
      </nav>
    </div>
  );
  
}

const controlsWidthPx = 140;
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
      justify-content: center;
      list-style: none;
      list-style-position: inside;
      border: 0 solid #6d6d6d;
      border-left-width: 1px;
    }
    a {
      padding: 0 5px;
      color: #ccc;
      height: 100%;
      display: flex;
      align-items: center;
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
