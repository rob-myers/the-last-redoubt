import { css } from "@emotion/css";

export const iconCss = ({
  basename,
  margin= 'auto',
  dim: dimPx= 13,
  invert,
}: {
  basename: (
    | 'cross-circle'
    | 'compress'
    | 'ext-link'
    | 'expand'
    | 'hash-icon'
    | 'light-bulb'
    | 'refresh'
  );
  margin?: string;
  /** Pixels */
  dim?: number;
  invert?: boolean;
}) => css`
  &::after {
    display: inline-block;
    content: '';
    background-image: url('/icon/${basename}.svg');
    background-size: ${dimPx}px ${dimPx}px;
    height: ${dimPx}px;
    width: ${dimPx}px;
    margin: ${margin};
    filter: ${invert ? 'invert(100%)' : 'none'};
  }
`;
