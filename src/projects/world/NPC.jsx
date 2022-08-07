import React from "react";
import { css, cx } from "@emotion/css";

import { cssName } from 'projects/service/const';
import createNpc from "./create-npc";
import useStateRef from "projects/hooks/use-state-ref";

/** @param {Props} props  */
export default function NPC({ api, def, disabled }) {

  const npc = useStateRef(() =>
    createNpc(def, { disabled, api }),
  );

  React.useEffect(() => {
    api.npcs.npc[def.npcKey] = npc;
    api.npcs.events.next({ key: 'spawned-npc', npcKey: def.npcKey });
    // if (npc.anim.spriteSheet === 'idle') {
    //   npc.startAnimation(); // Start idle animation
    // }
    return () => {
      // window.clearTimeout(npc.anim.wayTimeoutId);
      delete api.npcs.npc[def.npcKey];
      api.npcs.events.next({ key: 'unmounted-npc', npcKey: def.npcKey });
    };
  }, []);

  return (
    <div
      ref={npc.npcRef.bind(npc)}
      className={cx(
        cssName.npc,
        npc.key,
        npc.anim.spriteSheet,
        rootCss,
        npc.anim.css,
      )}
      data-npc-key={npc.key}
    >
      <div
        className={cx(cssName.npcBody, npc.key, 'no-select')}
        data-npc-key={npc.key}
      />
      <div className="interact-circle" />
      <div className="bounds-circle" />
    </div>
  );
}

/**
 * @typedef Props @type {object}
 * @property {import('./World').State} api
 * @property {PropsDef} def
 * @property {boolean} [disabled]
 */

const rootCss = css`
  position: absolute;
  pointer-events: none;
  
  .body {
    position: absolute;
    filter: grayscale(100%) brightness(140%);
    /** Animate turning */
    transition: transform 1s;
  }
  
  // TODO replace below with service/npc-json 🚧

  &.disabled .body {
    animation-play-state: paused;
  }

  .interact-circle {
    display: var(--npcs-debug-display);
    position: absolute;
    width: calc(2 * var(${cssName.npcsInteractRadius}));
    height: calc(2 * var(${cssName.npcsInteractRadius}));
    left: calc(-1 * var(${cssName.npcsInteractRadius}));
    top: calc(-1 * var(${cssName.npcsInteractRadius}));
    border-radius: calc(2 * var(${cssName.npcsInteractRadius}));
    border: 1px solid rgba(0, 0, 255, 0.25);
  }

  .bounds-circle {
    display: var(${cssName.npcsDebugDisplay});
    position: absolute;
    width: calc(2 * var(${cssName.npcBoundsRadius}));
    height: calc(2 * var(${cssName.npcBoundsRadius}));
    left: calc(-1 * var(${cssName.npcBoundsRadius}));
    top: calc(-1 * var(${cssName.npcBoundsRadius}));
    border-radius: calc(2 * var(${cssName.npcBoundsRadius}));
    border: 1px solid rgba(255, 0, 0, 0.25);
  }
`;

/**
 * @typedef PropsDef @type {object}
 * @property {string} npcKey
 * @property {NPC.NpcJsonKey} npcJsonKey
 * @property {Geom.VectJson} position
 * @property {number} speed
 * @property {number} angle
 */