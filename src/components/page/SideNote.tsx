import React from 'react';
import { css } from '@emotion/css';

/**
 * TODO support mobile e.g. via custom tooltip
 */
export default function SideNote(props: Props) {
  return (
    <span
      title={props.title}
      className={rootCss}
    >
      *
    </span>
  );
}

interface Props {
  title: string;
}

const rootCss = css`
  cursor: pointer;
  padding: 0 4px 0 1px;
  border: thin solid var(--page-border-color);
  border-radius: 2px 2px 0 0;
`;
