import React from "react";
import { css } from "@emotion/css";
import { tryLocalStorageSet } from "projects/service/generic";
import useSiteStore from "store/site.store";
import { cssName, localStorageKey, zIndex } from 'projects/service/const';
import Link from "./Link";
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

      {meta && (meta.navGroup !== null) && (
        <nav className={cssName.navMini}>
          <ul>
            <li>
              <Link href={prev?.path || meta.path} backward>
                <span className="prev">prev</span>
              </Link>
            </li>
            <li>
              <Link href={meta.path}>
                <span className="primary">id</span>
              </Link>
            </li>
            <li>
              <Link href={next?.path || meta.path}>
                <span className="next">next</span>
              </Link>
            </li>
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
      )}
    </div>
  );
  
}

const controlsWidthPx = 120;
const darkToggleWidthPx = 40;

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
    justify-content: center;
    align-items: stretch;
    padding: 0;
    margin: 0;

    li {
      list-style: none;
      list-style-position: inside;
      padding: 0 5px;
    }
    a {
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
