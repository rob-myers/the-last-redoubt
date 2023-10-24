import React from 'react';

/**
 * @param {Props} props 
 */
export default function GmsCanvas(props) {
  return <>
    {props.gms.map((gm, gmId) => (
      <canvas
        key={gmId}
        ref={el => el && props.canvasRef?.(el, gmId)}
        className={`gm-${gmId}`}
        width={gm.pngRect.width * props.scaleFactor}
        height={gm.pngRect.height * props.scaleFactor}
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          /**
           * - gm.transformStyle applies layout transform
           * - translate by gm.pngRect because PNG may be larger (e.g. hull doors)
           * - scale for higher quality
           */
          transformOrigin: "top left",
          transform: `${gm.transformStyle} scale(${1 / props.scaleFactor}) translate(${
            props.scaleFactor * gm.pngRect.x
          }px, ${props.scaleFactor * gm.pngRect.y}px)`,
          ...props.style,
        }}
      />
    ))}
  </>;
}

/**
 * @typedef Props
 * @property {(el: HTMLCanvasElement, gmId: number) => void} [canvasRef]
 * @property {Geomorph.GeomorphDataInstance[]} gms
 * @property {number} scaleFactor
 * @property {React.CSSProperties} [style]
 */
