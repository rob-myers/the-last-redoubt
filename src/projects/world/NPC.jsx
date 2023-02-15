import React from "react";
import { css, cx } from "@emotion/css";

import { cssName } from '../service/const';
import { supportsWebp } from '../service/dom';
import createNpc from "./create-npc";
import useStateRef from "../hooks/use-state-ref";

/** @param {Props} props  */
export default function NPC({ api, def, disabled }) {

  const npc = useStateRef(() => {
    const lookup = api.npcs.npc;
    if (lookup[def.key]) {
      const spawned = lookup[def.key];
      spawned.epochMs = Date.now();
      spawned.def = def;
      // 🚧 on HMR could update using use-state-ref approach
      return spawned;
    } else {
      return lookup[def.key] = createNpc(def, { disabled, api });
    }
  }, {
    deps: [def],
  });
  
  
  React.useLayoutEffect(() => {// useLayoutEffect for initial css
    if (npc.unspawned) {
      npc.initialize();
      api.npcs.events.next({ key: 'spawned-npc', npcKey: def.key });
    }
  }, [npc.epochMs]);

  return (
    <div
      ref={npc.npcRef.bind(npc)}
      className={cx(
        cssName.npc,
        rootCss,
        npc.anim.css,
        npc.anim.spriteSheet,
      )}
      data-npc-key={npc.key}
    >
      <div
        className={cx(
          cssName.npcBody,
          npc.key,
          'no-select',
          // ℹ️ saw webp break background-position animation
          supportsWebp ? 'webp' : undefined,
        )}
        data-npc-key={npc.key}
      />
      <div className="interact-circle" />
      <div className="bounds-circle" />
    </div>
  );
}

/**
 * @typedef Props
 * @property {import('./World').State} api
 * @property {NPC.NPCDef} def
 * @property {boolean} [disabled]
 */

const rootCss = css`
  position: absolute;
  pointer-events: none;
  // 🚧 should reinit on spawn
  /* ${cssName.npcLookRadians}: 0rad; */

  .body {
    position: absolute;
    /* filter: grayscale(100%) brightness(140%); */
    /* filter: grayscale(100%); */
    /** Animate turning */
    transition: transform 1s ease;
  }
  
  &.disabled .body {
    animation-play-state: paused;
  }

  .interact-circle {
    display: var(${cssName.npcsDebugDisplay});
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

export const MemoizedNPC = React.memo(NPC);
