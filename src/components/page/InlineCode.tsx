import React from 'react';
import { css, cx } from '@emotion/css';
import useSiteStore from 'store/site.store';
import { cssTimeMs } from 'projects/service/const';

export default function InlineCode({ children, ...props }: Props) {
  return (
    <code
      {...props.copy && {
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
  display: inline-block;
  -webkit-tap-highlight-color: transparent;
  line-height: 1.2;
  
  /** Add specificity to override Article code */
  &.inline-code {
    font-family: "Ubuntu Mono", "Courier New", monospace;
    font-size: 1rem;
    color: #0f0;
    letter-spacing: 1px;
    padding: 0 4px;
    background-color: #000;
    
    @media (max-width: 600px) {
      font-size: 1rem;
      padding: 2px 4px;
    }
  }

  /* cursor: pointer; */
  position: relative;

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
`;

// Currently copy-click unsupported
export function InlineUniCode({ children, ...props }: Props) {
  return (
    <span className="inline-uni-code" style={{ fontSize: '0.9rem' }}>
      {children}
    </span>
  );
}
