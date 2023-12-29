/// @ts-nocheck
import { Texture, Rectangle } from "@pixi/core";
import { Sprite } from "@pixi/sprite";
import TWEEN from '@tweenjs/tween.js';

import { Poly, Rect, Vect } from '../geom';
import { precision, testNever } from "../service/generic";
import { warn } from "../service/log";
import { hasGmDoorId } from "../service/geomorph";
import { npcRadius, npcClassToSpineHeadSkin, spineAnimToSetup, defaultNpcInteractRadius } from "./const";
import { obscuredNpcOpacity, spawnFadeMs } from "../world/const";

import spineMeta from "static/assets/npc/top_down_man_base/spine-meta.json";

/**
 * @param {NPC.NPCDef} def
 * @param {import('./WorldPixi').State} api
 * @returns {NPC.NPC}
 */
export default function createNpc(def, api) {
  const { baseTexture } = api.npcs.tex;
  const sharedAnimData = getSharedAnimData('idle');
  const headSkinName = npcClassToSpineHeadSkin[def.classKey];

  return {
    key: def.key,
    classKey: def.classKey,
    epochMs: Date.now(),
    def,

    el: /** @type {*} */ ({}), // Fix types during migration
    s: {
      body: new Sprite(new Texture(baseTexture)),
      head: new Sprite(new Texture(baseTexture)),
    },

    anim: /** @type {*} */ ({}), // Fix types during migration
    a: {
      shared: sharedAnimData,
      durations: getAnimDurations(sharedAnimData, def.walkSpeed),
      initHeadWidth: spineMeta.head[headSkinName].packedHead.top.width,

      path: [],
      aux: {
        angs: [],
        edges: [],
        elens: [],
        index: 0,
        outsetSegBounds: new Rect,
        outsetWalkBounds: new Rect,
        // roomWalkBounds: new Rect,
        segBounds: new Rect,
        sofars: [],
        total: 0,
      },
      staticBounds: new Rect,
      
      animName: 'idle',
      opacity: emptyTween,
      rotate: emptyTween,
      time: 0,
      paused: false, // 👈 new

      neckAngle: 0,
      speedFactor: 1,
      defaultSpeedFactor: 1,
      
      doorStrategy: 'none',
      gmRoomIds: [],
      prevWayMetas: [],
      wayMetas: [],
      wayTimeoutId: 0,
    },

    doMeta: null,
    forcePaused: false,
    gmRoomId: null,
    has: { key: api.gmGraph.gms.map(_ => ({})) },
    navOpts: {
      centroidsFallback: true,
      closedWeight: 10 * 1000, // avoid closed doors (?)
    },
    navPath: null,
    nextWalk: null,
    unspawned: true,

    // 🚧 methods
    
    async animateOpacity(targetOpacity, durationMs) {
      this.a.opacity.stop();
      try {
        await (this.a.opacity = api.tween([this.s.body, this.s.head]).to([
          { alpha: targetOpacity },
          { alpha: targetOpacity },
        ], durationMs)).promise();
      } catch (e) {// Reset opacity if cancelled
        [this.s.body, this.s.head].forEach(s => s.alpha = 1);
        throw Error('cancelled');
      }
    },
    async animateRotate(targetRadians, durationMs, throwOnCancel) {
      this.a.rotate.stop();
    
      // Assume {source,target}Radians in [-π, π]
      const sourceRadians = this.getAngle();
      if (targetRadians - sourceRadians > Math.PI) targetRadians -= 2 * Math.PI;
      if (sourceRadians - targetRadians > Math.PI) targetRadians += 2 * Math.PI;

      try {
        await (this.a.rotate = api.tween([this.s.body, this.s.head]).to([
          { rotation: targetRadians },
          { rotation: targetRadians },
        ], durationMs).easing(TWEEN.Easing.Quadratic.In)).promise();
      } catch {
        if (throwOnCancel) throw new Error('cancelled');
      }
    },
    async cancel(overridePaused = false) {
      if (this.forcePaused && !overridePaused) {
        throw Error('paused: cannot cancel');
      }

      console.log(`cancel: cancelling ${this.def.key}`);

      this.a.opacity.stop();
      this.a.rotate.stop();

      if (this.a.animName === 'walk') {
        this.nextWalk = null;
        this.clearWayMetas(); // Cancel pending actions
        this.startAnimation('idle'); // Must change to stop walking?
      }
      
      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
    },
    canLook() {
      return (this.a.animName === 'idle' ||
        this.a.animName === 'idle-breathe') && !this.doMeta;
    },
    changeClass(npcClassKey) {// we don't trigger render
      this.classKey = npcClassKey;
    },
    clearWayMetas() {
      this.a.wayMetas.length = 0;
      this.a.prevWayMetas.length = 0;
      window.clearTimeout(this.a.wayTimeoutId);
    },
    computeAnimAux() {
      const { aux } = this.a;
      const radius = this.getRadius();
      aux.outsetWalkBounds = Rect.fromPoints(...this.a.path).outset(radius);
      aux.edges = this.a.path.map((p, i) => ({ p, q: this.a.path[i + 1] })).slice(0, -1);
      aux.angs = aux.edges.map(e => precision(Math.atan2(e.q.y - e.p.y, e.q.x - e.p.x)));
      // accuracy needed for wayMeta length computation
      aux.elens = aux.edges.map(({ p, q }) => p.distanceTo(q));
      // aux.elens = aux.edges.map(({ p, q }) => precision(p.distanceTo(q)));
      // aux.navPathPolys = aux.edges.map(e => {
      //   const normal = e.q.clone().sub(e.p).rotate(Math.PI/2).normalize(0.01);
      //   return new Poly([e.p.clone().add(normal), e.q.clone().add(normal), e.q.clone().sub(normal), e.p.clone().sub(normal)]);
      // });
      const reduced = aux.elens.reduce((agg, length) => {
        agg.total += length;
        agg.sofars.push(agg.sofars[agg.sofars.length - 1] + length);
        return agg;
      }, { sofars: [0], total: 0 });
      aux.sofars = reduced.sofars
      aux.total = reduced.total;
      aux.index = 0;
    },
    computeWayMetaLength(navMeta) {
      if (navMeta.key === 'at-door') {
        const gm = api.gmGraph.gms[navMeta.gmId];
        const navPoint = gm.inverseMatrix.transformPoint(this.a.path[navMeta.index].clone());
        const door = gm.doors[navMeta.doorId];
        const distanceToDoor = Math.abs(door.normal.dot(navPoint.sub(door.seg[0])));
        // change length so npc is close to door
        return Math.max(0, this.a.aux.sofars[navMeta.index] + distanceToDoor - (this.getRadius() + 5));
      } else {
        return this.a.aux.sofars[navMeta.index];
      }
    },
    async do(point, opts = {}) {
      if (this.forcePaused) {
        throw Error('paused: cannot do');
      }
      if (this.isPaused()) {
        await this.cancel();
      }
      point.meta ??= {}; // possibly manually specified (not via `click [n]`)

      try {
        if (point.meta.door && hasGmDoorId(point.meta)) {
          /** `undefined` -> toggle, `true` -> open, `false` -> close */
          const extraParam = opts.extraParams?.[0] === undefined ? undefined : !!opts.extraParams[0];
          const open = extraParam === true;
          const close = extraParam === false;
          const wasOpen = api.doors.lookup[point.meta.gmId][point.meta.doorId].open;
          const isOpen = api.doors.toggleDoor(point.meta.gmId, point.meta.doorId, { npcKey: this.key, close, open });
          if (close) {
            if (isOpen) throw Error('cannot close door');
          } else if (open) {
            if (!isOpen) throw Error('cannot open door');
          } else {
            if (wasOpen === isOpen) throw Error('cannot toggle door');
          }
        } else if (api.npcs.isPointInNavmesh(this.getPosition())) {
          if (this.doMeta) {// @ do point, on nav
            const navPath = api.npcs.getGlobalNavPath(this.getPosition(), point);
            await this.walk(navPath, { throwOnCancel: false });
          } else {
            await this.onMeshDoMeta(point, opts);
          }
          this.doMeta = point.meta.do ? point.meta : null;
        } else {
          await this.offMeshDoMeta(point, opts);
          this.doMeta = point.meta.do ? point.meta : null;
        }
      } catch (e) {// Swallow 'cancelled' errors e.g. start new walk, obstruction
        if (!(e instanceof Error && (e.message === 'cancelled' || e.message.startsWith('cancelled:')))) {
          throw e;
        }
      }
    },
    everWalked() {
      return this.a.wayTimeoutId !== 0;
    },
    extendNextWalk(...points) {// 👈 often a single point
      const currentNavPath = this.navPath;
      if (!this.isWalking() || !currentNavPath || currentNavPath.path.length === 0) {
        return warn(`extendNextWalk: ${this.a.animName}: must be walking`);
      }
      if (points.length === 0) {
        return;
      }

      const currentPath = currentNavPath.path;
      this.nextWalk ??= { visits: [], navPath: api.lib.getEmptyNavPath() };
      
      const src = this.nextWalk.visits.at(-1) ?? /** @type {Geom.Vect} */ (currentPath.at(-1));
      const deltaNavPath = api.npcs.getGlobalTour([src, ...points], this.navOpts);
      this.nextWalk.navPath = api.lib.concatenateNavPaths([this.nextWalk.navPath, deltaNavPath]);
      this.nextWalk.visits.push(...points.map(Vect.from));

      const extendedNavPath = api.lib.concatenateNavPaths([currentNavPath, this.nextWalk.navPath]);
      api.debug.addNavPath(api.lib.getNavPathName(def.key), extendedNavPath);
      api.debug.render();
    },
    async fadeSpawn(point, opts = {}) {
      try {
        const meta = opts.meta ?? point.meta ?? {};
        point.meta ??= meta; // 🚧 can remove?
        const direction = Vect.from(point).sub(this.getPosition());
        await this.animateOpacity(0, opts.fadeOutMs ?? spawnFadeMs);
        await api.npcs.spawn({
          npcKey: this.key,
          point,
          angle: opts.angle ?? (direction.x ? Math.atan2(direction.y, direction.x) : undefined) ,
          npcClassKey: opts.npcClassKey,
          requireNav: opts.requireNav,
        });
        this.startAnimationByMeta(meta);
        await this.animateOpacity(meta.obscured ? obscuredNpcOpacity : 1, spawnFadeMs);
      } catch (e) {
        await this.animateOpacity(this.doMeta?.obscured ? obscuredNpcOpacity : 1, spawnFadeMs);
        throw e;
      }
    },
    filterWayMetas(shouldRemove) {
      const { wayMetas } = this.a;
      this.a.wayMetas = wayMetas.filter(meta => !shouldRemove(meta));
      if (wayMetas[0] && shouldRemove(wayMetas[0])) {
        window.clearTimeout(this.a.wayTimeoutId);
        this.nextWayTimeout();
      }
    },
    async followNavPath(navPath, doorStrategy) {
      const { path, navMetas: globalNavMetas, gmRoomIds } = navPath;
      // warn('START followNavPath')
      // might jump i.e. path needn't start from npc position
      this.navPath = navPath;
      this.a.path = path.map(Vect.from);
      // from `nav` for decor collisions
      this.a.gmRoomIds = gmRoomIds;
      this.a.doorStrategy = doorStrategy ?? 'none';
      this.a.speedFactor = this.a.defaultSpeedFactor;

      this.clearWayMetas();
      this.computeAnimAux();

      // Convert navMetas to wayMetas
      this.a.wayMetas = globalNavMetas.map((navMeta) => ({
        ...navMeta,
        length: this.computeWayMetaLength(navMeta),
      }));

      this.startAnimation('walk');
      api.npcs.events.next({
        key: 'started-walking',
        npcKey: this.key,
        navPath,
        continuous: this.getPosition().distanceTo(path[0]) <= 0.01,
        extends: !!this.nextWalk,
      });
      this.nextWalk = null;
      this.nextWayTimeout();

      // ℹ️ detecting walk finish via rotate tween...
      try {
        console.log(`followNavPath: ${this.key} started walk`);
        await this.a.rotate.promise();
        console.log(`followNavPath: ${this.key} finished walk`);
        this.wayTimeout(); // immediate else startAnimation('idle') will clear
      } catch (e) {
        console.log(`followNavPath: ${this.key} cancelled walk`);
        throw Error('cancelled');
      } finally {
        this.a.speedFactor = this.a.defaultSpeedFactor; // Reset speed to default
      }
    },
    getAnimScaleFactor() {
      return 0; // Fix types during migration
    },
    getAngle() {
      return this.s.body.rotation;
    },
    getFrame() {
      return Math.floor(this.a.time) % this.a.shared.frameCount;
    },
    getInteractRadius() {
      return defaultNpcInteractRadius;
    },
    getLineSeg() {
      const dst = this.getTarget();
      if (dst) {
        const src = this.getPosition();
        return { src, dst, tangent: dst.clone().sub(src).normalize() };
      } else {
        return null;
      }
    },
    getNextDoorId() {
      return this.a.wayMetas.find(
        /** @returns {meta is NPC.NpcWayMetaExitRoom} */
        meta => meta.key === 'exit-room' // stay in current gmId
      )?.doorId;
    },
    getPosition() {
      return Vect.from(this.s.body.position);
    },
    getPrevDoorId() {
      return this.a.prevWayMetas.findLast(
        /** @returns {meta is NPC.NpcWayMetaExitRoom} */
        meta => meta.key === 'exit-room'
      )?.doorId;
    },
    getRadius() {
      return npcRadius;
    },
    getSpeed() {
      return this.def.walkSpeed * this.a.speedFactor;
    },
    getTarget() {
      if (this.isWalking()) {
        const { a } = this;
        const currDist = a.rotate.getTime() * this.getSpeed();
        const nextIndex = a.aux.sofars.findIndex(soFar => soFar > currDist);
        return nextIndex === -1 ? null : a.path[nextIndex].clone(); // Expect -1 iff at final point
      } else {
        return null;
      }
    },
    getTargets() {
      if (this.isWalking()) {
        const { a } = this;
        const soFarMs = a.rotate.getTime();
        const invSpeed = 1 / this.getSpeed();
        return a.aux.sofars
          .map((soFar, i) => ({ point: a.path[i].clone(), arriveMs: (soFar * invSpeed) - soFarMs }))
          .filter(x => x.arriveMs >= 0);
      } else {
        return [];
      }
    },
    getWalkAnimDef() {// Fix types during migration
      return /** @type {*} */ ({});
    },
    getWalkBounds() {
      return this.anim.aux.outsetWalkBounds;
    },
    getWalkCurrentTime() {
      return 0; // Fix types during migration
    },
    getWalkCycleDuration(entireWalkMs) {
      return 0; // Fix types during migration
    },
    getWalkSegBounds(withNpcRadius) {
      return withNpcRadius ? this.a.aux.outsetSegBounds : this.a.aux.segBounds;
    },
    hasDoorKey(gmId, doorId) {
      return !!this.has.key[gmId]?.[doorId];
    },
    inferWalkTransform() {
      return { position: Vect.zero, angle: 0 }; // Fix types during migration
    },
    inFrustum(point) {
      return api.npcs.inFrustum(this.getPosition(), point, this.getAngle());
    },
    initialize() {
      this.a.staticBounds = new Rect(this.def.position.x - npcRadius, this.def.position.y - npcRadius, 2 * npcRadius, 2 * npcRadius);
      // Include doors so doorways have some gmRoomId too
      this.gmRoomId = api.gmGraph.findRoomContaining(this.def.position, true);
    },
    intersectsCircle(position, radius) {
      return this.getPosition().distanceTo(position) <= this.getRadius() + radius;
    },
    isIdle() {
      return ['idle', 'idle-breathe'].includes(this.a.animName);
    },
    isPaused() {
      return this.a.paused;
    },
    isPointBlocked(point, permitEscape = false) {
      const closeNpcs = api.npcs.getCloseNpcs(this.key);

      if (!closeNpcs.some(other =>
        other.intersectsCircle(point, npcRadius)
        && api.npcs.handleBunkBedCollide(other.doMeta ?? undefined, point.meta)
      )) {
        return false;
      }

      const position = this.getPosition();
      if (permitEscape && closeNpcs.some(other =>
        other.intersectsCircle(position, npcRadius)
        && api.npcs.handleBunkBedCollide(other.doMeta ?? undefined, this.doMeta ?? undefined)
      )) {
        return false;
      }

      return true;
    },
    isWalking() {
      return this.a.animName === 'walk';
    },
    obscureBySurfaces() {
      if (!this.gmRoomId) {
        return warn(`${this.key}: cannot obscure npc outside any room`);
      }
      const { gmId, roomId } = this.gmRoomId;
      const gm = api.gmGraph.gms[gmId];
      // 🚧 use better approx e.g. angled 4-gon
      const npcBounds = this.a.staticBounds.clone().applyMatrix(gm.inverseMatrix);

      const intersection = Poly.intersect(
        (gm.roomSurfaceIds[roomId] ?? [])
          .map(id => gm.groups.obstacles[id].poly)
          .filter(x => x.rect.intersects(npcBounds)),
        [Poly.fromRect(npcBounds)],
      );
      api.doors.obscureNpc(gmId, intersection);
    },

    setupAnim(animName) {
      const { a, s } = this;
      a.animName = animName;
      a.time = 0;

      const { headOrientKey } = spineAnimToSetup[animName]
      const { animBounds, headFrames, neckPositions } = spineMeta.anim[animName];
      
      a.shared = getSharedAnimData(animName);
      a.durations = getAnimDurations(a.shared, this.getSpeed());

      // Changing frame width/height later deforms image
      const bodyRect = a.shared.bodyRects[a.time];
      const headRect = spineMeta.head[headSkinName].packedHead[headOrientKey];
      s.body.texture.frame = new Rectangle(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      s.head.texture.frame = new Rectangle(headRect.x, headRect.y, headRect.width, headRect.height);

      // Body anchor is (0, 0) in spine world coords
      s.body.anchor.set(Math.abs(animBounds.x) / animBounds.width, Math.abs(animBounds.y) / animBounds.height);
      // Head anchor is neck position
      s.head.anchor.set(
        (neckPositions[0].x - headFrames[0].x) / headFrames[0].width,
        (neckPositions[0].y - headFrames[0].y) / headFrames[0].height,
      );
      
      s.body.scale.set(spineMeta.npcScaleFactor);
      s.body.angle = this.getAngle();
      a.initHeadWidth = headRect.width;

      this.updateSprites();
    },
    // ℹ️ currently NPC.SpriteSheetKey equals NPC.SpineAnimName
    // 🚧 fix "final walk frame jerk" elsewhere
    startAnimation(animName) {
      this.a.animName = animName;
      this.a.rotate.stop();
      
      switch (animName) {
        case 'walk': {
          this.a.rotate.stop(); // fix `npc do` orientation
          this.setupAnim(animName);

          // 🚧 chained rotate tween
          // e.g. using aux.sofars[i] / aux.total
          const totalMs = (1 / this.getSpeed()) * this.a.aux.total * 1000;
          this.a.rotate = api.tween(this.s.body).to({}, totalMs).start();
          
          break;
        }
        case 'idle':
        case 'idle-breathe':
        case 'lie':
        case 'sit': {
          this.clearWayMetas();
          this.updateStaticBounds();
          if (animName === 'sit') {// Ensure feet are below surfaces
            this.obscureBySurfaces();
          }
          this.a.rotate = emptyTween;
          this.setupAnim(animName);
          break;
        }
        default:
          throw testNever(animName, { suffix: 'create-npc.startAnimation' });
      }
    },
    updateSprites() {
      const currFrame = this.getFrame();
      const { bodyRects, rootDeltas, headFrames, neckPositions } = this.a.shared;
      const { body, head, bounds: circularBounds } = this.s;

      // body
      body.texture._uvs.set(
        /** @type {Rectangle} */ (bodyRects[currFrame]),
        baseTexture,
        0,
      );
      const radians = body.rotation;
      if (rootDeltas.length) {
        // pixi.js convention: 0 degrees ~ north ~ negative y-axis
        const rootDelta = rootDeltas[currFrame];
        body.x += rootDelta * Math.sin(radians);
        body.y -= rootDelta * Math.cos(radians);
      }
      // head
      const { angle, width } = headFrames[currFrame];
      const neckPos = neckPositions[currFrame];
      head.angle = angle + body.angle + this.a.neckAngle;
      head.scale.set(width / this.a.initHeadWidth);
      head.position.set(
        body.x + Math.cos(radians) * neckPos.x - Math.sin(radians) * neckPos.y,
        body.y + Math.sin(radians) * neckPos.x + Math.cos(radians) * neckPos.y,
      );
      // extras
      if (circularBounds) {
        circularBounds.position.copyFrom(body.position);
      }
    },
    updateStaticBounds() {
      const pos = this.getPosition();
      const radius = this.getRadius();
      this.a.staticBounds.set(pos.x - radius, pos.y - radius, 2 * radius, 2 * radius);
    },
  };
}

/** @type {NPC.TweenExt} */
const emptyTween = Object.assign(new TWEEN.Tween({}), {
  promise: () => Promise.resolve({}),
  getTime: () => 0,
});

const sharedAnimData = /** @type {Record<NPC.SpineAnimName, NPC.SharedAnimData>} */ (
  {}
);

/**
 * @param {NPC.SpineAnimName} animName
 * @returns {NPC.SharedAnimData}
 */
function getSharedAnimData(animName) {
  const { headFrames, frameCount, rootDeltas, neckPositions } = spineMeta.anim[animName];
  return sharedAnimData[animName] ??= {
    animName,
    frameCount,
    bodyRects: spineMeta.anim[animName].packedRects,
    headFrames,
    neckPositions,
    rootDeltas,
    headOrientKey: spineAnimToSetup[animName].headOrientKey,
    stationaryFps: spineAnimToSetup[animName].stationaryFps,
  };
}

/**
 * 
 * @param {NPC.SharedAnimData} shared 
 * @param {number} walkSpeed World units per second
 */
function getAnimDurations(shared, walkSpeed) {
  if (shared.rootDeltas.length) {// rootDeltas in our world coords
    return shared.rootDeltas.map(delta => delta / walkSpeed);
  } else {
    return [...Array(shared.frameCount)].map(_ => 1 / shared.stationaryFps);
  }
}
