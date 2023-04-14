/** @type {NPC.NpcClassConfig} */
const manBaseVariant = {
  // Made using Spriter Pro
  anim: {
    idle: {
      frameCount: 1,
      speed: 0,
      totalDist: 0,
      durationMs: 0,
      rotateDeg: 90,
    },
    'idle-breathe': {
      frameCount: 24,
      speed: 0,
      totalDist: 0,
      durationMs: 3000,
      rotateDeg: 90,
    },
    lie: {
      frameCount: 1,
      speed: 0,
      totalDist: 0,
      durationMs: 0,
      rotateDeg: 90,
    },
    sit: {
      frameCount: 1,
      speed: 0,
      totalDist: 0,
      durationMs: 0,
      rotateDeg: 90,
    },
    walk: {
      durationMs: -1, // 🚧 overwritten
      frameCount: 14,
      shiftFramesBy: -4,
      rotateDeg: 90,
      speed: 70, // 🚧 justify
      totalDist: 600, // 🚧 justify
    },
  },
  radius: 850 * 0.2, // Export scale is 20%
};

/**
 * Hard-coded data may be necessary.
 * - unclear how to extract "number of frames" from Spriter *.scml file.
 * - need to guess "totalDist" unless we track bones somehow...
 * - non-trivial to rotate Spriter animation when lack root bone
 * @type {Record<NPC.NpcClassKey, NPC.NpcClassConfig>}
 */
export const npcClassConfig = {
  /**
   * See media/NPC/class/first-human-npc.
   */
  "first-human-npc": {
    // Made using Synfig
    anim: {
      idle: { frameCount: 1, speed: 0, totalDist: 0, durationMs: 0 },
      "idle-breathe": {
        frameCount: 20,
        speed: 0,
        totalDist: 0,
        durationMs: 1000,
      },
      // Currently, the 'lie' spritesheet is just a copy of 'sit'
      lie: { frameCount: 1, speed: 0, totalDist: 0, durationMs: 0 },
      sit: { frameCount: 1, speed: 0, totalDist: 0, durationMs: 0 },
      walk: {
        frameCount: 10,
        speed: 70, // 🚧 justify
        totalDist: 286.66,
        durationMs: -1, // 🚧 overwritten
      },
    },
    radius: 80,
  },
  /**
   * See media/NPC/class/*
   */
  "vilani-a": manBaseVariant,
  "zhodani-a": manBaseVariant,
};
