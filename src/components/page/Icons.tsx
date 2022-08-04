import { css } from "@emotion/css";

export const iconCss = ({
  basename,
  margin= 'auto',
  dim: dimPx= 13,
  invert,
  center,
}: {
  basename: (
    | 'circle-right'
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
  center?: boolean;
}) => css`
  &::after {
    display: ${center ? 'flex' : 'inline-block'};
    align-items: ${center ? 'center' : 'unset' };
    content: '';
    background-image: url('/icon/${basename}.svg');
    background-size: ${dimPx}px ${dimPx}px;
    height: ${dimPx}px;
    width: ${dimPx}px;
    margin: ${margin};
    filter: ${invert ? 'invert(100%)' : 'none'};
  }
`;
