import React from 'react';
import { css, cx } from '@emotion/css';
import useSiteStore from 'store/site.store';
import { cssTimeMs } from 'projects/service/const';

export default function InlineCode({ children, ...props }: Props) {
  return (
    <code
      onClick={useSiteStore.api.clickToClipboard}
      title="click to copy text"
      {...props}
      className={cx(rootCss, props.className)}
    >
      {children}
    </code>
  );
}

type Props = React.HTMLAttributes<HTMLElement>;

const rootCss = css`
  font-family: "Ubuntu Mono", "Courier New", monospace;
  color: #0f0;
  background-color: #000;
  padding: 0 4px;
  font-size: 1rem;
  letter-spacing: 1px;

  cursor: pointer;
  position: relative;

  &.just-copied::after {
    content: 'Copied';
    position: absolute;
    top: -32px;
    right: 0;
    padding: 8px;
    line-height: 1;
    color: white;
    background: #444;
    border-radius: 4px;
    font-size: 12px;
    font-family: sans-serif;
    animation: fadeInOut ${cssTimeMs.justCopied}ms ease-in-out both;
  }  
`;
