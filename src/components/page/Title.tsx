import { navigate } from "gatsby";
import React from "react";
import { cx, css } from "@emotion/css";

import { siteTitle } from "projects/service/const";
import NavMini from "./NavMini";

export default function Title() {
  return (
    <header className={cx('title', titleCss)}>
      <NavMini/>
      <h1 onClick={() => navigate('/')}>
        {siteTitle}
      </h1>
      <p>
        Programming NPCs using CSS and a Web CLI 
      </p>
    </header>
  );
}

const titleCss = css`
  position: relative;
  
  @media(max-width: 600px) {
    padding-left: 8px;
    border-bottom: 1px solid #777;
  }
  
  h1 {
    display: inline-block;
    margin: 0;
    margin-top: 40px;
    margin-left: 4px;

    /* font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; */
    font-family: 'Courier New', Courier, monospace;
    font-size: 4.8rem;
    font-weight: 500;
    letter-spacing: 4px;
    cursor: pointer;
    color: var(--page-title-color);
    text-transform: uppercase;
    text-shadow: 0 0 8px var(--title-text-shadow-color);
    
    @media(max-width: 1200px) {
      font-size: 4.6rem;
    }
    @media(max-width: 800px) {
      text-shadow: 0 0 4px var(--title-text-shadow-color);
      font-size: 3.5rem;
    }
    @media(max-width: 600px) {
      text-shadow: 0 0 2px var(--title-text-shadow-color);
      margin-top: 72px;
      font-size: 2.5rem;
    }
  }
  
  /** Site subtitle */
  p {
    margin: 0;
    padding: 40px 0 48px;
    margin-right: 4px;
    
    color: var(--page-title-color);
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    font-size: 1rem;
    font-weight: 300;
    letter-spacing: 2px;
    
    @media(max-width: 600px) {
      padding: 24px 0 28px 4px;
    }
  }

`;
