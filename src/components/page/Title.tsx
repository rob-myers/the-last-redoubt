import { navigate } from "gatsby";
import React from "react";
import { cx, css } from "@emotion/css";

import NavMini from "./NavMini";

export default function Title() {
  return (
    <header className={cx('title', titleCss)}>
      <NavMini/>
      <h1 onClick={() => navigate('/')}>
        The Last Redoubt
      </h1>
      <p>
        $( video game | web dev | game ai )
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
    margin: 0;
    font-size: 4.8rem;
    font-weight: 300;
    letter-spacing: 4px;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
    cursor: pointer;
    color: #444;
    text-transform: uppercase;
    text-shadow: 0 0 2px #888888bb;
    padding-top: 40px;
    
    @media(max-width: 800px) {
      font-size: 3.5rem;
    }
    @media(max-width: 600px) {
      padding-top: 72px;
      font-size: 2.2rem;
      color: #333;
    }
  }
  
  /** Site subtitle */
  p {
    color: #424242;
    font-size: 1rem;
    font-family: 'Courier New', Courier, monospace;
    margin: 0;
    padding: 40px 0 48px;
    font-weight: 300;
    text-transform: lowercase;
    
    @media(max-width: 600px) {
      padding: 24px 0 28px 4px;
    }
  }

`;
