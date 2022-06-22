import React from 'react';
import { css } from "@emotion/css";

export default function Sep() {
  return <hr className={rootCss} />;
}

const rootCss = css`
  margin: 0;

  @media(min-width: 800px) {
    padding-bottom: 80px;
    border: 0;
  }
`;
