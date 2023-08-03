import React from "react";
import { css, cx } from "@emotion/css";

import { cssName } from './const';
import { supportsWebp } from '../service/dom';
import { decorToRef } from "../service/geomorph";
import createNpc from "./create-npc";
import useStateRef from "../hooks/use-state-ref";

/** @param {Props} props  */
export default function NPC({ api, npcKey }) {

  const state = useStateRef(() => api.npcs.npc[npcKey], {
    deps: [npcKey],
    updateFrom: (current) => createNpc(current.def, { api }),
  });
  
  React.useLayoutEffect(() => {
    if (state.unspawned) {// (Re)spawn
      state.unspawned = false;
      state.initialize();
      state.startAnimation('idle');
      api.npcs.events.next({ key: 'spawned-npc', npcKey,
        decors: api.decor.getDecorAtPoint(state.getPosition()).map(decorToRef)
      });
    }
  }, [state.epochMs]);

  return (
    <div
      ref={state.npcRef.bind(state)}
      className={cx(
        cssName.npc,
        rootCss,
        api.npcs.playerKey === npcKey ? 'player' : undefined,
        state.anim.css,
        state.anim.spriteSheet,
      )}
    >
      <div
        className={cx(
          cssName.npcBody,
          state.key,
          supportsWebp ? 'webp' : undefined,
        )}
      >
        <img src="/assets/npc/fov-indicator.png" className="fov-indicator" />
      </div>
      <div className="interact-circle" />
      <div className="bounds-circle" />
      <div
        className="head-circle"
        data-meta={JSON.stringify({ npc: true, ui: true, npcKey: state.key })}
      />
    </div>
  );
}

/**
 * @typedef Props
 * @property {import('./World').State} api
 * @property {string} npcKey
 */

const rootCss = css`
  position: absolute;
  pointer-events: none;

  &.player .body {
    ~ div {
      display: var(${cssName.npcsDebugPlayerDisplay});
    }
    .fov-indicator {
      display: var(${cssName.npcsDebugPlayerDisplay});
    }
  }

  .body {
    position: absolute;
    // Related to geomorph drop-shadow i.e. render-geomorph shadowBlur
    filter: brightness(90%) drop-shadow(0 0 72px black);

    display: flex;
    justify-content: center;
    align-items: center;

    .fov-indicator {
      display: var(${cssName.npcsDebugDisplay});
      position: absolute;
      transform: scale(3.2) translateX(50%);
      opacity: 0.4;
    }
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

  .head-circle {
    display: var(${cssName.npcsDebugDisplay});
    pointer-events: all;
    cursor: pointer;
    position: absolute;
    width: calc(2 * var(${cssName.npcHeadRadius}));
    height: calc(2 * var(${cssName.npcHeadRadius}));
    left: calc(-1 * var(${cssName.npcHeadRadius}));
    top: calc(-1 * var(${cssName.npcHeadRadius}));
    border-radius: calc(2 * var(${cssName.npcHeadRadius}));
    border: 1px solid rgba(0, 0, 0, 0.25);
  }
`;

/** @type {React.MemoExoticComponent<(props: Props & { epochMs: number }) => JSX.Element>} */
export const MemoizedNPC = React.memo(NPC);
