import React from 'react';

/**
 * Based on https://stackoverflow.com/a/54749871/2917822
 * @param {() => void} [callback] 
 * @param {number} [ms] 
 * @returns 
 */
export default function useLongPress(callback = () => {}, ms = 500) {
  const timerId = React.useRef(-1);
  return {
    onMouseDown() { timerId.current = window.setTimeout(callback, ms) },
    onMouseUp() { clearTimeout(timerId.current) },
    onMouseLeave(){ clearTimeout(timerId.current) },
    onTouchStart(){ timerId.current = window.setTimeout(callback, ms) },
    onTouchEnd(){ clearTimeout(timerId.current) },
  };
}