/**
 * Source: https://github.com/minwork/use-double-tap/blob/master/src/index.ts
 */
import React from 'react';

// type EmptyCallback = () => void;

/**
 * @typedef CallbackFunction @type {React.MouseEventHandler}
 * @template {Element} Target
 */
/**
 * @typedef DoubleTapCallback @type {CallbackFunction<Target> | null}
 * @template {Element} Target
 */
/**
 * @typedef DoubleTapOptions @type {{ onSingleTap?: CallbackFunction<Target> }}
 * @template {Element} Target
 */
/**
 * @typedef DoubleTapResult @type {Callback extends CallbackFunction<Target> ? { onClick: CallbackFunction<Target>; } : Callback extends null ? {} : never}
 * @template {Element} Target
 * @template Callback
 */

/**
 * @template {Element} Target
 * @template {DoubleTapCallback<Target>} Callback
 * @param {Callback} [callback ]
 * @param {number} [threshold] 
 * @param {DoubleTapOptions<Target>} [options] 
 * @returns {DoubleTapResult<Target, Callback>}
 */
export function useDoubleTap(
    callback,
    threshold = 300,
    options = {}
) {
    /** @type {React.MutableRefObject<NodeJS.Timeout | null>} */
    const timer = React.useRef(null);

    const handler = React.useCallback(
        /** @param {React.MouseEvent<Target>} event */
        (event) => {
            if (!timer.current) {
                timer.current = setTimeout(() => {
                    if (options.onSingleTap) {
                        options.onSingleTap(event);
                    }
                    timer.current = null;
                }, threshold);
            } else {
                clearTimeout(timer.current);
                timer.current = null;
                callback && callback(event);
            }
        },
        [callback, threshold, options.onSingleTap]
    );

    return /** @type {DoubleTapResult<Target, Callback>} */ (callback
        ? { onClick: handler }
        : {}
    );
}