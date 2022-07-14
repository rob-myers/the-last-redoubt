import React from "react";
import { cx, css } from "@emotion/css";
import { tryLocalStorageSet } from "projects/service/generic";
import useSiteStore from "store/site.store";
import { cssName } from "../css-names";
import Link from "./Link";
import { barHeight } from "./Nav";
import { iconCss } from "./Icons";

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
        </nav>
      )}

      <div
        className={cx(
          'toggle-dark-mode',
          iconCss({ basename: 'light-bulb' }),
        )}
        onClick={(e) => {
          const enabled = document.body.classList.toggle('dark-mode');
          tryLocalStorageSet('dark-mode-enabled', `${enabled}`);
        }}
      />
    </div>
  )
  
  
}

const width = 140;

const rootCss = css`
  position: absolute;
  z-index: 10;
  right: ${width}px;
  top: -32px;
  @media(max-width: 600px) { top: 0; }

  display: flex;
  font-size: 1rem;

  ul {
    position: fixed;
    width: ${width}px;
    height: ${barHeight}px;
    right: 30px;

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

  .toggle-dark-mode {
    position: fixed;
    width: ${30}px;
    right: ${5}px;
    height: ${barHeight}px;
    display: flex;
    justify-content: center;
    color: white;
    cursor: pointer;
    filter: invert(100%);
  }
`;
