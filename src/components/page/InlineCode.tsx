import React from 'react';
import { css, cx } from '@emotion/css';
import useSiteStore from 'store/site.store';
import { cssTimeMs } from 'projects/service/const';

export default function InlineCode({ children, copy, ...props }: Props) {
  return (
    <code
      {...copy && {
        title: "click to copy text",
        onClick: useSiteStore.api.clickToClipboard,
        style: { cursor: 'pointer' },
      }}
      {...props}
      className={cx(
        'inline-code',
        rootCss,
        props.className,
      )}
    >
      {children}
    </code>
  );
}

type Props = React.HTMLAttributes<HTMLElement> & {
  copy?: boolean;
};

const rootCss = css`
  /** ISSUE with changing width via ::after when display: inline */
  -webkit-tap-highlight-color: transparent;
  
  /** Add specificity to override Article code */
  &.inline-code {
    font-family: "Ubuntu Mono", "Courier New", monospace;
    font-style: normal;
    font-size: 1rem;
    color: #0f0;
    letter-spacing: 1px;
    background-color: #333;
    padding: 0 8px;
    border-radius: 4px;
    line-height: 1.4;
    /* border: 1px solid #eeeeee22; */
  }

  /* cursor: pointer; */
  position: relative;
  display: inline-block;

  &::after {
    display: none;
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

  &.just-copied::after {
    content: 'Copied';
    display: initial;
  }

  &.copy-just-failed::after {
    content: 'Copy failed';
    display: initial;
  }

  &::selection {
    background-color: rgb(85, 112, 149);
    color: white;
  }
`;
