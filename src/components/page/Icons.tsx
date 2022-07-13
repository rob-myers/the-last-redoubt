import { css } from "@emotion/css";

export const iconCss = (
  basename: (
    | 'anchor-icon'
    | 'anchor-icon-white'
    | 'circle-xmark'
    | 'compress'
    | 'eye'
    | 'eye-slash'
    | 'ext-link-icon'
    | 'expand-solid'
    | 'hash-icon'
    | 'light-bulb'
  ),
  margin = 'auto',
  dimPx = 13
) => css`
  &::after {
    display: inline-block;
    content: '';
    background-image: url('/icon/${basename}.svg');
    background-size: ${dimPx}px ${dimPx}px;
    height: ${dimPx}px;
    width: ${dimPx}px;
    margin: ${margin};
  }
`;
