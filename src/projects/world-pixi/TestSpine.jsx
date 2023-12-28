import React from "react";
import PixiReact from "@pixi/react";

import { Assets } from '@pixi/assets';
import { TextureAtlas, SpineDebugRenderer } from '@pixi-spine/base';
import { AtlasAttachmentLoader, SkeletonJson, Spine, Skin, SkeletonData } from '@pixi-spine/runtime-4.1';

import { skeletonScale } from '../world/const';
import { useQueryOnce } from "../hooks/use-query-utils";;

import topDownManAtlasContents from '!!raw-loader!static/assets/npc/top_down_man_base/man_01_base.atlas';

/**
 * @param {{ api: import('./WorldPixi').State }} param0 
 */
export default function TestSpine({ api }) {
  const { data } = useQueryOnce('test-npc', () => loadSpine('man_01_base'));
  return data
    ? <TestInstantiateSpine api={api} skeletonData={data.data} />
    : null;
}

const TestInstantiateSpine = PixiReact.PixiComponent('TestInstantiateSpine', {
  /** @param {{ api: import('./WorldPixi').State; skeletonData: SkeletonData; }} props  */
  create(props) {
    const spine = instantiateSpine(props.skeletonData);
    // console.log(spine);
    spine.state.setAnimation(0, 'idle', false);
    // spine.state.setAnimation(0, 'walk', true);
    spine.update(0);

    const { width: frameWidth } = spine.skeleton.getBoundsRect();
    spine.scale.set((2 * 13) / frameWidth);
    spine.position.set(spine.width/2, 0);
    return spine;
  },
});

/**
 * @param {string} baseName
 * https://github.com/pixijs/spine/blob/master/examples/preloaded_json.md
 */
async function loadSpine(baseName) {
  const runtimeSpineFolder = '/assets/npc/top_down_man_base';
  const skeletonDataJson = await Assets.load(`${runtimeSpineFolder}/${baseName}.json`);

  const textureAtlas = new TextureAtlas();
  await new Promise((resolve, reject) => textureAtlas.addSpineAtlas(
    topDownManAtlasContents,
    async (line, callback) => Assets.load(`${runtimeSpineFolder}/${line}`).then((tex) => callback(tex)),
    atlas => atlas ? resolve(atlas) : reject(`something went wrong e.g. texture failed to load`),
  ));

  const atlasLoader = new AtlasAttachmentLoader(textureAtlas);
  const skeletonParser = new SkeletonJson(atlasLoader);
  skeletonParser.scale = skeletonScale;

  const skeletonData = skeletonParser.readSkeletonData(skeletonDataJson)
  return { atlasLoader, data: skeletonData };
}

/**
 * @param {SkeletonData} skeletonData
 */
function instantiateSpine(skeletonData) {
  const spine = new Spine(skeletonData);

  const newSkin = new Skin("npc-default-skin");
  // Black body with grey gloves
  newSkin.addSkin(spine.spineData.findSkin("shoes/black-trainers"));
  newSkin.addSkin(spine.spineData.findSkin("trousers/black-trousers"));
  newSkin.addSkin(spine.spineData.findSkin("torso/black-shirt"));
  newSkin.addSkin(spine.spineData.findSkin("gloves/grey-gloves"));
  // The head will change
  newSkin.addSkin(spine.spineData.findSkin("head/skin-head-light"));
  spine.skeleton.setSkin(newSkin);
  spine.skeleton.setSlotsToSetupPose();

  // const debugRenderer = new SpineDebugRenderer();
  // debugRenderer.drawBones = false;
  // debugRenderer.drawBoundingBoxes = true;
  // debugRenderer.drawClipping = true;
  // spine.debug = debugRenderer;

  return spine;
}
