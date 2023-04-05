import React from 'react';

/**
 * Based on https://stackoverflow.com/a/54749871/2917822
 * Invokes onClick if press isn't long enough.
 * @param {() => void} [onLongPress] 
 * @param {(e: React.MouseEvent | React.TouchEvent) => void} [onClick] 
 * @param {number} [ms] 
 */
export default function useLongPress(
  onLongPress = () => {},
  onClick = () => {},
  ms = 500,
) {
  const timerId = React.useRef(-1);
  const epochMs = React.useRef(-1);
  return {
    onMouseDown() { timerId.current = window.setTimeout(onLongPress, ms); epochMs.current = Date.now(); },
    onTouchStart(){ timerId.current = window.setTimeout(onLongPress, ms); epochMs.current = Date.now(); },
    /** @param {React.MouseEvent} e */
    onMouseUp(e) { clearTimeout(timerId.current); (Date.now() - epochMs.current) < ms && onClick(e); },
    /** @param {React.TouchEvent} e */
    onTouchEnd(e) { clearTimeout(timerId.current); (Date.now() - epochMs.current) < ms && onClick(e); },
    onMouseLeave(){ clearTimeout(timerId.current) },
  };
}