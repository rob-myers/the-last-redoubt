import React from "react";
import { css, cx } from "@emotion/css";

import { cssName } from '../service/const';
import { supportsWebp } from '../service/dom';
import createNpc from "./create-npc";
import useStateRef from "../hooks/use-state-ref";

/** @param {Props} props  */
export default function NPC({ api, npcKey, disabled }) {

  const npc = useStateRef(() => api.npcs.npc[npcKey], {
    deps: [npcKey],
    updateFrom: (current) => createNpc(current.def, { disabled, api }),
  });
  
  React.useLayoutEffect(() => {
    if (npc.unspawned) {
      npc.initialize(); // useLayoutEffect because we modify styles here
      npc.unspawned = false;
      npc.startAnimation('idle');
      /** @type {NPC.DecorRef[]} */
      const intoDecor = api.decor.getDecorAtPoint(npc.getPosition()).map(d => ({
        decorKey: d.key,
        type: d.type,
        meta: d.meta,
      }));
      api.npcs.events.next({ key: 'spawned-npc', npcKey, intoDecor });
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
          supportsWebp ? 'webp' : undefined,
        )}
        data-npc-key={npc.key}
      />
      <div className="interact-circle" />
      <div className="bounds-circle" />
      <div
        className="head-circle"
        data-meta={JSON.stringify({ npc: true, ui: true, npcKey: npc.key })}
      />
    </div>
  );
}

/**
 * @typedef Props
 * @property {import('./World').State} api
 * @property {string} npcKey
 * @property {boolean} [disabled]
 */

const rootCss = css`
  position: absolute;
  pointer-events: none;

  .body {
    position: absolute;
    /* filter: grayscale(100%) brightness(140%); */
    /* filter: grayscale(100%); */
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

  .head-circle {
    pointer-events: all;
    cursor: pointer;
    display: var(${cssName.npcsDebugDisplay});
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
