import React from "react";
import { cx, css } from "@emotion/css";
import useSiteStore from "store/site.store";
import { cssName } from "../css-names";
import Link from "./Link";
import { barHeight } from "./Nav";

export default function NavMini() {

  const { meta, prev, next } = useSiteStore(x => {
    const meta = x.articleKey ? x.articlesMeta[x.articleKey] : null;
    const prev = meta?.prev ? x.articlesMeta[meta.prev] : null;
    const next = meta?.next ? x.articlesMeta[meta.next] : null;
    return { meta, prev, next };
  }, () => true);

  return meta && (meta.navGroup !== null)  ? (
    <nav className={cx(cssName.navMini, rootCss)}>
      <ul>
        <li>
          <Link href={prev?.path || meta.path} backward>
            <span className="prev">prev</span>
          </Link>
        </li>
        <li>
          <Link href={meta.path}>
            <span className="primary">⬆</span>
          </Link>
        </li>
        <li>
          <Link href={next?.path || meta.path}>
            <span className="next">next</span>
          </Link>
        </li>
      </ul>
    </nav>
  ) : null;
}

const width = 140;

const rootCss = css`
  position: absolute;
  z-index: 10;
  right: ${width}px;
  top: -40px;
  @media(max-width: 1024px) { top: -32px; }
  @media(max-width: 600px) { top: 0; }

  font-size: 1rem;

  > ul {
    background: #000;
    position: fixed;
    width: ${width}px;
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
`;
