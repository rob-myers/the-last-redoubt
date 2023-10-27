import React from 'react';
import { cx, css } from '@emotion/css';
import { supportsWebp } from 'projects/service/dom';
import { cssName } from 'projects/service/const';

export default function Icon({
  icon,
  small,
  large,
  inline,
  invert,
  bottom,
  className,
  ...props
}: Props) {
  return (
    <span
      className={cx(
        baseIconCss,
        'icon', // Needed to match icons.css
        supportsWebp ? 'webp' : undefined,
        icon,
        small ? 'small-icon' : undefined,
        large ? 'large-icon' : undefined,
        inline ? 'inline-icon' : undefined,
        invert ? 'invert-icon' : undefined,
        bottom ? 'bottom-icon' : undefined,
        className,
      )}
      {...props}
    />
  );
}

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  /** Icon identifier */
  icon: (
    | 'checked'
    | 'compress'
    | 'cross-circle'
    | 'expand'
    | 'ext-link'
    | 'hash-icon'
    | 'info-icon'
    | 'light-bulb'
    | 'lying-man'
    | 'qed-icon'
    | 'refresh'
    | 'road-works'
    | 'sitting-silhouette'
    | 'standing-person'
  );
  small?: boolean;
  large?: boolean;
  inline?: boolean;
  invert?: boolean;
  bottom?: boolean;
}

const baseIconCss = css`
  &::after {
    display: flex;
    align-items: center;
    content: '';

    background-size: var(${cssName.iconSizeBase}) var(${cssName.iconSizeBase});
    height: var(${cssName.iconSizeBase});
    width: var(${cssName.iconSizeBase});
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
    background-size: var(${cssName.iconSizeSmall}) var(${cssName.iconSizeSmall});
    height: var(${cssName.iconSizeSmall});
    width: var(${cssName.iconSizeSmall});
  }
  &.large-icon::after {
    background-size: var(${cssName.iconSizeLarge}) var(${cssName.iconSizeLarge});
    height: var(${cssName.iconSizeLarge});
    width: var(${cssName.iconSizeLarge});
  }
  &.bottom-icon {
    vertical-align: text-bottom;
  }
`;

export const RoadWorksIcon = (props: Partial<Props>) =>
  <Icon icon="road-works" inline large {...props} />;

export const QedIcon = () =>
  <Icon icon="qed-icon" inline large bottom />;
