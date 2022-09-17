import React from 'react';
import { cx, css } from '@emotion/css';

export default function Icon({ icon, small, inline, invert, className, ...props }: Props) {
  return (
    <span
      className={cx(
        baseIconCss,
        'icon', // Needed to match icons.css
        icon,
        small ? 'small-icon' : undefined,
        inline ? 'inline-icon' : undefined,
        invert ? 'invert-icon' : undefined,
        className,
      )}
      {...props}
    />
  );
}

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  /** Icon identifier */
  icon: string;
  small?: boolean;
  inline?: boolean;
  invert?: boolean;
}

const baseIconCss = css`
  &::after {
    display: flex;
    align-items: center;
    content: '';

    background-size: var(--icon-size-base) var(--icon-size-base);
    height: var(--icon-size-base);
    width: var(--icon-size-base);
  }

  &.invert-icon::after {
    filter: invert(100%);
  }
  &.inline-icon {
    display: inline-flex;
  }
  &.inline-icon::after {
    display: flex;
    align-items: stretch;
  }

  &.small-icon::after {
    background-size: var(--icon-size-small) var(--icon-size-small);
    height: var(--icon-size-small);
    width: var(--icon-size-small);
  }  
`;
