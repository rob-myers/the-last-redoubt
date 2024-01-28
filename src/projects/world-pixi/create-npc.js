import { Texture, Rectangle } from "@pixi/core";
import { Sprite } from "@pixi/sprite";
import TWEEN from '@tweenjs/tween.js';

import { Poly, Rect, Vect } from '../geom';
import { precision, testNever } from "../service/generic";
import { info, warn } from "../service/log";
import { geom } from "../service/geom";
import { hasGmDoorId } from "../service/geomorph";
import { npcRadius, npcClassToSpineHeadSkin, spineAnimSetup, defaultNpcInteractRadius, spineAnimNames } from "./const";
import { obscuredNpcOpacity, spawnFadeMs } from "../world/const";

import spineMeta from "static/assets/npc/top_down_man_base/spine-meta.json";

/**
 * @param {NPC.NPCDef} def
 * @param {import('./WorldPixi').State} api
 * @returns {NPC.NPC}
 */
export default function createNpc(def, api) {
  const { baseTexture } = api.npcs.tex;
  return {
    key: def.key,
    classKey: def.classKey,
    epochMs: Date.now(),
    def,

    animName: 'idle',
    distance: 0,
    frame: 0,
    frameDurs: [Infinity],
    frameMap: [0],
    framePtr: 0,
    neckAngle: 0,
    time: 0,
    tr: tracks['idle'],
    walkCancel: emptyFn,
    walkFinish: emptyFn,
    walkOnSpot: false,
    walkSpeed: def.walkSpeed,

    el: /** @type {*} */ ({}), // Fix types during migration
    s: {
      body: new Sprite(new Texture(baseTexture)),
      head: new Sprite(new Texture(baseTexture)),
    },

    anim: /** @type {*} */ ({}), // Fix types during migration
    a: {
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
      initHeadWidth: 0,
      
      opacity: emptyTween,
      rotate: emptyTween,
      wait: emptyTween,

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
    // avoid closed doors?
    navOpts: { centroidsFallback: true, closedWeight: 10 * 1000 },
    navPath: null,
    nextWalk: null,
    paused: false,
    unspawned: true, // old

    async animateOpacity(targetOpacity, durationMs, onlyBody = false) {
      this.a.opacity.stop();
      try {
        await (this.a.opacity = api.tween(
          onlyBody ? this.s.body : [this.s.body, this.s.head]
        ).to(
          onlyBody ? {alpha: targetOpacity} : [{ alpha: targetOpacity }, { alpha: targetOpacity }],
          durationMs,
        )).promise();
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
        await (this.a.rotate = api.tween(this.s.body)
          .to({ rotation: targetRadians }, durationMs)
          .onUpdate(() => this.updateHead())
          .easing(TWEEN.Easing.Quadratic.Out)
        ).promise();
      } catch {
        if (throwOnCancel) throw new Error('cancelled');
      }
    },
    async cancel(overridePaused = false) {
      if (this.forcePaused && !overridePaused) {
        throw Error('paused: cannot cancel');
      }
      info(`cancel: cancelling ${this.def.key}`);

      if (this.animName === 'walk') {
        this.nextWalk = null;
        this.clearWayMetas();
        // 🚧 might cause late collision test (when no wayMetas)
        !this.paused && await this.walkToIdle().catch(_ => {});
        this.startAnimation('idle');
      }

      this.paused = false;
      this.walkOnSpot = false;
      this.a.opacity.stop();
      this.a.rotate.stop();
      this.a.wait.stop();
      this.walkCancel(new Error('cancelled'));

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
    },
    canLook() {
      return (this.animName === 'idle' ||
        this.animName === 'idle-breathe') && !this.doMeta;
    },
    changeClass(npcClassKey) {
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
      if (!Vect.isVectJson(point)) {
        throw Error('point expected');
      }
      if (this.forcePaused) {
        throw Error('paused: cannot do');
      }
      if (this.isPaused()) {
        await this.cancel();
      }
      point.meta ??= {};

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
        return warn(`extendNextWalk: ${this.animName}: must be walking`);
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
        point.meta ??= meta;
        await this.animateOpacity(0, opts.fadeOutMs ?? spawnFadeMs);
        const position = this.getPosition();
        await api.npcs.spawn({
          npcKey: this.key,
          point,
          angle: opts.angle ?? (position.equals(point) ? undefined : Math.PI/2 + Vect.from(point).sub(position).angle),
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
      this.navPath = navPath; // can jump: path needn't start from npc position
      this.a.path = path.map(Vect.from);
      // for decor collisions
      this.a.gmRoomIds = gmRoomIds;
      this.a.doorStrategy = doorStrategy ?? 'none';
      // reset to default speed?
      this.walkSpeed = this.def.walkSpeed;

      this.clearWayMetas();
      this.computeAnimAux();
      // Convert navMetas to wayMetas
      this.a.wayMetas = globalNavMetas.map((navMeta) => ({
        ...navMeta,
        length: this.computeWayMetaLength(navMeta),
      }));
      
      if (path.length > 1 && this.nextWalk === null) {// turn first
        await this.lookAt(path[1], 500 * geom.compareAngles(
          this.getAngle(),
          this.a.aux.angs[0] + Math.PI/2,
        ));
      }

      this.startAnimation('walk');

      // 🚧 chained rotation tweens
      // const totalLen = this.a.aux.total;
      // this.a.aux.sofars.reduce((agg, soFar) => {
      //   return agg.chain({  });
      // }, api.tween(this.s.body));

      api.npcs.events.next({
        key: 'started-walking',
        npcKey: this.key,
        navPath,
        continuous: this.getPosition().distanceTo(path[0]) <= 0.01,
        extends: !!this.nextWalk,
      });
      this.nextWalk = null;
      this.nextWayTimeout();

      try {
        console.log(`followNavPath: ${this.key} started walk`);
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          this.walkFinish = resolve;
          this.walkCancel = reject;
        }));
        console.log(`followNavPath: ${this.key} finished walk`);
        this.wayTimeout(); // immediate else startAnimation('idle') will clear
      } catch (e) {
        console.log(`followNavPath: ${this.key} cancelled walk`);
        throw Error('cancelled');
      } finally {// Reset speed to default?
        this.walkSpeed = this.def.walkSpeed;
      }
    },
    getAnimScaleFactor() {
      return 1000 * (1 / this.getSpeed()); // ms per world-unit
    },
    getAngle() {
      return this.s.body.rotation;
    },
    getHeadSkinRect() {
      return spineMeta.head[
        npcClassToSpineHeadSkin[this.def.classKey]
      ].packedHead[
        spineAnimSetup[this.animName].headOrientKey
      ];
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
    getPath() {
      return this.a.path;
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
      return this.walkSpeed;
    },
    getStaticBounds() {
      return this.a.staticBounds;
    },
    getTarget() {
      if (this.isWalking()) {
        const nextIndex = this.a.aux.sofars.findIndex(soFar => soFar > this.distance);
        // Expect -1 iff at final point
        return nextIndex === -1 ? null : this.a.path[nextIndex].clone();
      } else {
        return null;
      }
    },
    getTargets() {
      if (this.isWalking()) {
        const nextIndex = this.a.aux.sofars.findIndex(soFar => soFar > this.distance);
        return nextIndex === -1 ? [] : this.a.path.slice(nextIndex).map(p => p.clone());
      } else {
        return [];
      }
    },
    getWalkAnimDef() {// Fix types during migration
      return /** @type {*} */ ({});
    },
    getWalkBounds() {
      return this.a.aux.outsetWalkBounds;
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
      this.s.body.position.copyFrom(this.def.position);
      this.s.body.rotation = this.def.angle;
      this.a.staticBounds = new Rect(this.def.position.x - npcRadius, this.def.position.y - npcRadius, 2 * npcRadius, 2 * npcRadius);
      // Include doors so doorways have some gmRoomId too
      this.setGmRoomId(api.gmGraph.findRoomContaining(this.def.position, true));
    },
    intersectsCircle(position, radius) {
      return this.getPosition().distanceTo(position) <= this.getRadius() + radius;
    },
    isIdle() {
      return ['idle', 'idle-breathe'].includes(this.animName);
    },
    isPaused() {
      return this.paused;
    },
    isPlayer() {
      return this.key === api.npcs.playerKey;
    },
    isBlockedByOthers(start, next) {
      if (next) {
        const pos = this.getPosition();
        return api.npcs.getCloseNpcs(this.key).some(other => {
          const otherPos = other.getPosition();
          if (
            other.intersectsCircle(start, npcRadius)
            && api.npcs.handleBunkBedCollide(other.doMeta ?? undefined, start.meta)
            && (next.x - start.x) * (otherPos.x - pos.x) + (next.y - start.y) * (otherPos.y - pos.y) >= 0
          ) {
            return true;
          }
        });
      } else {
        return api.npcs.getCloseNpcs(this.key).some(other =>
          other.intersectsCircle(start, npcRadius)
          && api.npcs.handleBunkBedCollide(other.doMeta ?? undefined, start.meta)
        );
      }
    },
    isWalking() {// Not walking when transitioning to idle
      return this.animName === 'walk' && this.frameMap.length === this.tr.length;
    },
    async lookAt(point, ms = 1000) {
      if (!Vect.isVectJson(point)) {
        throw Error(`invalid point: ${JSON.stringify(point)}`);
      }
      if (this.forcePaused) {
        throw Error('paused: cannot look');
      }
      if (this.isWalking() || this.isPaused()) {
        await this.cancel(); // 🤔
      }
      if (!this.canLook()) {
        throw Error('cannot look');
      }

      const position = this.getPosition();
      const direction = Vect.from(point).sub(position);
      if (direction.length === 0) {
        return; // Don't animate
      }
      const targetRadians = Math.PI/2 + Math.atan2(direction.y, direction.x);
      await this.animateRotate(targetRadians, ms);
    },
    nextWayTimeout() {
      if (this.a.wayMetas[0]) {
        const msToWait = (this.a.wayMetas[0].length - this.distance) * this.getAnimScaleFactor();
        this.a.wayTimeoutId = window.setTimeout(this.wayTimeout.bind(this), msToWait);
      }
    },
    npcRef() {
      // Fix types during migration
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
    async offMeshDoMeta(point, opts = {}) {
      const src = this.getPosition();
      const meta = point.meta ?? {};

      if (!opts.suppressThrow && !meta.do && !meta.nav) {
        throw Error('not doable nor navigable');
      }
      if (!opts.suppressThrow && (
        src.distanceTo(point) > this.getInteractRadius()
        || !api.gmGraph.inSameRoom(src, point)
        || !api.npcs.canSee(src, point, this.getInteractRadius())
      )) {
        throw Error('too far away');
      }

      await this.fadeSpawn(// non-navigable uses targetPoint:
        { ...point, ...!meta.nav && /** @type {Geom.VectJson} */ (meta.targetPos) },
        {
          angle: meta.nav && !meta.do
            // use direction src --> point if entering navmesh
            ? src.equals(point) ? undefined : Vect.from(point).sub(src).angle + Math.PI/2
            // use meta.orient if staying off-mesh
            : typeof meta.orient === 'number' ? (meta.orient + 90) * (Math.PI / 180) : undefined,
          fadeOutMs: opts.fadeOutMs,
          meta,
        },
      );
    },
    async onMeshDoMeta(point, opts = {}) {
      const src = this.getPosition();
      const meta = point.meta ?? {};
      /** The actual "do point" (e.point is somewhere on icon) */
      const decorPoint = /** @type {Geom.VectJson} */ (meta.targetPos) ?? point;

      if (!opts.suppressThrow && !meta.do) {
        throw Error('not doable');
      }
      if (!api.gmGraph.inSameRoom(src, decorPoint)) {
        throw Error('too far away');
      }

      if (api.npcs.isPointInNavmesh(decorPoint)) {// Walk, [Turn], Do
        const navPath = api.npcs.getGlobalNavPath(this.getPosition(), decorPoint);
        await this.walk(navPath, { throwOnCancel: true });
        typeof meta.orient === 'number' && await this.animateRotate((meta.orient + 90) * (Math.PI / 180), 100);
        this.startAnimationByMeta(meta);
        return;
      }

      if (!opts.suppressThrow && (
        src.distanceTo(point) > this.getInteractRadius())
        || !api.npcs.canSee(src, point, this.getInteractRadius())
      ) {
        throw Error('too far away');
      }

      await this.fadeSpawn({ ...point, ...decorPoint }, {
        angle: typeof meta.orient === 'number' ? (meta.orient + 90) * (Math.PI / 180) : undefined,
        requireNav: false,
        fadeOutMs: opts.fadeOutMs,
        meta,
      });
    },
    pause(forced = true) {
      if (forced) {
        this.forcePaused = true;
      }
      this.updateStaticBounds();

      console.log(`pause: pausing ${this.def.key}`);
      this.a.opacity.pause();
      this.a.rotate.pause();
      this.a.wait.pause();
      this.paused = true;

      if (this.animName === 'walk') {
        window.clearTimeout(this.a.wayTimeoutId);
      }

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'paused' });
    },
    resume(forced = true) {
      if (this.forcePaused && !forced) {
        return;
      }
      console.log(`resume: resuming ${this.def.key}`);

      this.a.opacity.resume();
      this.a.rotate.resume();
      this.a.wait.resume();
      this.forcePaused = false;
      this.paused = false;

      if (this.animName === 'walk') {
        this.nextWayTimeout();
      }

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'resumed' });
    },
    setupAnim(animName) {
      this.tr = tracks[animName];
      if (animName === 'walk') {
        if (this.animName === animName) {
          // preserve walk
        } else {// 🚧 remove hard-coding
          this.time = 0;
          this.frame = Math.random() > 0.5 ? 0 : 16;
        }
      } else {
        this.time = 0;
        this.frame = 0;
      }
      this.framePtr = this.frame;
      this.frameMap = this.tr.bodys.map((_, i) => i);
      this.distance = 0;
      this.walkOnSpot = false;
      this.frameFinish = undefined;
      this.animName = animName;
      
      const { stationaryFps } = spineAnimSetup[animName];
      this.frameDurs = this.tr.deltas?.map(x => x / this.walkSpeed) ?? this.tr.bodys.map(_ => 1 / stationaryFps);
      
      const { body, head } = this.s;
      // every body frame has same width/height
      const bodyRect = this.tr.bodys[this.frame];
      body.texture.frame = new Rectangle(bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height);
      const headRect = this.getHeadSkinRect();
      head.texture.frame = new Rectangle(headRect.x, headRect.y, headRect.width, headRect.height);

      // body anchor is (0, 0) in spine coords
      // every body frame has same width/height
      const localBodyBounds = spineMeta.anim[animName].animBounds;
      body.anchor.set(Math.abs(localBodyBounds.x) / localBodyBounds.width, Math.abs(localBodyBounds.y) / localBodyBounds.height);

      // Head anchor via neck position in spine coords
      head.anchor.set(// 🚧 precompute
        (spineMeta.anim[animName].neckPositions[0].x - spineMeta.anim[animName].headFrames[0].x) / spineMeta.anim[animName].headFrames[0].width,
        (spineMeta.anim[animName].neckPositions[0].y - spineMeta.anim[animName].headFrames[0].y) / spineMeta.anim[animName].headFrames[0].height,
      );

      body.scale.set(spineMeta.npcScaleFactor);
      body.rotation = this.getAngle();
      this.a.initHeadWidth = headRect.width;

      this.updateSprites();
    },
    setGmRoomId(next) {
      if (this.gmRoomId) {
        delete api.npcs.byRoom[this.gmRoomId.gmId][this.gmRoomId.roomId][this.key];
      }
      if (next) {
        api.npcs.byRoom[next.gmId][next.roomId][this.key] = true;
      }
      this.gmRoomId = next;
    },
    setInteractRadius(radius) {
      // 🚧 currently unsupported
    },
    showBounds(shouldShow) {
      const { bounds } = this.s;
      if (shouldShow === undefined) {
        shouldShow = !bounds;
      }
      if (!shouldShow && bounds) {
        delete this.s.bounds;
        bounds.removeFromParent();
      }
      if (shouldShow && !bounds) {
        const { packedRect } = spineMeta.extra["circular-bounds"];
        const sprite = new Sprite(new Texture(baseTexture));
        sprite.texture.frame = new Rectangle(packedRect.x, packedRect.y, packedRect.width, packedRect.height);
        sprite.scale.set(spineMeta.npcScaleFactor);
        sprite.anchor.set(0.5);
        sprite.tint = '#00ff00';
        sprite.alpha = 0.5;
        sprite.position.copyFrom(this.s.body.position);
        this.s.bounds = sprite;
        api.npcs.pc.addChild(sprite);
      }
    },
    startAnimation(animName) {
      switch (animName) {
        case 'walk': {
          this.setupAnim(animName);
          break;
        }
        case 'idle':
        case 'idle-breathe':
        case 'lie':
        case 'sit':
          this.a.rotate.stop();
          this.a.rotate = emptyTween;
          this.clearWayMetas();
          this.updateStaticBounds();
          if (animName === 'sit') {// Ensure feet are below surfaces
            this.obscureBySurfaces();
          }
          this.setupAnim(animName);
          break;
        default:
          throw testNever(animName, { suffix: 'create-npc.startAnimation' });
      }
    },
    startAnimationByMeta(meta) {
      switch (true) {
        case meta.sit:
          this.startAnimation('sit');
          break;
        case meta.stand:
          this.startAnimation('idle-breathe');
          break;
        case meta.lie:
          this.startAnimation('lie');
          break;
      }
      this.doMeta = meta.do ? meta : null;
    },
    setSpeedFactor(speedFactor, temporary = true) {
      // Fix types during migration
    },
    setWalkSpeed(walkSpeed, temporary = true) {
      // By default, speed changes whilst walking are temporary
      if (!(this.animName === 'walk' && temporary)) {
        this.def.walkSpeed = walkSpeed;
      }
      if (this.walkSpeed === walkSpeed) {
        return; // Avoid infinite loop?
      }
      if (this.animName === 'walk') {
        // 🚧 chained rotate tween
        const totalMs = (this.a.aux.total - this.distance) * this.getAnimScaleFactor();
        this.a.rotate.stop().to({}, totalMs).start();
      }
      api.npcs.events.next({ key: 'changed-speed', npcKey: this.key, prevSpeed: this.walkSpeed, speed: walkSpeed });
      this.walkSpeed = walkSpeed;
    },
    updateHead() {
      const { body, head } = this.s;
      const { heads, necks } = this.tr;

      // const currFrame = this.getFrame();
      const currFrame = this.frame;
      const { angle, width } = heads[currFrame];
      const neckPos = necks[currFrame];
      const radians = body.rotation;

      head.angle = angle + body.angle + this.neckAngle;
      head.scale.set(width / this.a.initHeadWidth);
      head.position.set(
        body.x + Math.cos(radians) * neckPos.x - Math.sin(radians) * neckPos.y,
        body.y + Math.sin(radians) * neckPos.x + Math.cos(radians) * neckPos.y,
      );
    },
    updateRoomWalkBounds(srcIndex) {
      // Fix types during migration
    },
    updateSprites() {
      const { bodys, deltas } = this.tr;
      const { body } = this.s;
      body.texture._uvs.set(/** @type {Rectangle} */ (bodys[this.frame]), baseTexture, 0);

      if (deltas !== null && this.walkOnSpot === false) {
        const radians = body.rotation;
        const rootDelta = deltas[this.frame];
        body.x += rootDelta * Math.sin(radians); // pixi.js angle CW from north
        body.y -= rootDelta * Math.cos(radians);
      }

      this.updateHead();
      this.s.bounds?.position.copyFrom(body.position);
    },
    updateStaticBounds() {
      const pos = this.getPosition();
      const radius = this.getRadius();
      this.a.staticBounds.set(pos.x - radius, pos.y - radius, 2 * radius, 2 * radius);
    },
    updateTime(deltaRatio) {
      const { frame: prevFrame, frameDurs: durs, frameMap } = this;
      if (this.paused === true || frameMap.length === 1) {
        return;
      }
      // Could skip multiple frames in single update via low fps
      // https://github.com/pixijs/pixijs/blob/dev/packages/sprite-animated/src/AnimatedSprite.ts
      let lag = ((this.time % 1) * durs[this.frame]) + (deltaRatio * (1 / 60));

      while (lag >= durs[this.frame]) {
        lag -= durs[this.frame];
        this.time++;
        this.distance += this.tr.deltas?.[this.frame] ?? 0;
        if (++this.framePtr === frameMap.length) {
          this.frameFinish?.();
          this.framePtr = 0;
        }
        this.frame = frameMap[this.framePtr];
      }
      this.time = Math.floor(this.time) + (lag / durs[this.frame]);

      if (prevFrame !== this.frame) {
        this.updateSprites();
      }
    },
    updateWalkSegBounds(index) {
      const { aux, path } = this.a;
      aux.index = index;
      aux.segBounds.copy(Rect.fromPoints(path[index], path[index + 1]));
      aux.outsetSegBounds.copy(aux.segBounds).outset(this.getRadius());
    },
    async walk(navPath, opts = {}) {
      if (api.lib.isVectJson(navPath)) {
        navPath = api.npcs.getGlobalNavPath(this.getPosition(), navPath, this.navOpts);
      }
      if (!api.lib.verifyGlobalNavPath(navPath)) {
        this.nextWalk = null;
        throw Error(`invalid global navpath: ${JSON.stringify({ npcKey: this.key, navPath, opts })}`);
      }
      if (this.forcePaused) {
        this.nextWalk = null;
        throw Error('paused: cannot walk');
      }
      if (this.isPaused()) {
        await this.cancel(); // causes jerky extended walk?
      }
      if (navPath.path.length === 0) {
        this.nextWalk = null;
        return;
      }

      try {
        if (this.isBlockedByOthers(navPath.path[0], navPath.path[1])) {
          throw new Error('cancelled');
        }
        // Walk along navpath, possibly throwing 'cancelled' on collide
        await this.followNavPath(navPath, opts.doorStrategy);
        
        // Continue to next walk or transition to idle
        await (this.nextWalk ? this.walk(this.nextWalk.navPath, opts) : this.walkToIdle());

      } catch (err) {
        if (!opts.throwOnCancel && err instanceof Error && err.message === 'cancelled') {
          return warn(`walk cancelled: ${this.key}`);
        }
        throw err;
      } finally {
        api.npcs.events.next({ key: 'stopped-walking', npcKey: this.key });
        // this.startAnimation('idle');
        this.startAnimation('idle-breathe');
      }
    },
    async walkToIdle() {
      // 🔔 Assume `[first-cross, first-step, second-cross, second-step]` where first-cross `0`
      const frames = /** @type {number[]} */ (spineMeta.anim[this.animName].extremeFrames);
      const base = this.tr.bodys.map((_, i) => i); // [0...maxFrame]
      const nextId = frames.findIndex(x => x > this.frame);

      switch (nextId) {
        case  1: this.frameMap = base.slice(0, this.frame + 1).reverse(); break;
        case  2: this.frameMap = base.slice(this.frame, frames[2]); break;
        case  3: this.frameMap = base.slice(frames[2], this.frame + 1).reverse(); break;
        case -1: this.frameMap = base.slice(this.frame); break;
      }
      
      this.framePtr = 0;
      this.walkOnSpot = true;
      this.frameDurs = this.frameDurs.map(x => x/2);

      if (nextId === 1 || nextId === 3) {// Pause before moving feet back
        this.paused = true;
        await this.waitFor(150);
        this.paused = false;
      }
      if (this.frameMap.length > 1) {
        await /** @type {Promise<void>} */ (new Promise(resolve => this.frameFinish = resolve));
      }
    },
    async waitFor(ms) {
      await (this.a.wait = api.tween({}).to({}, ms)).promise();
    },
    // 🚧 avoid many short timeouts?
    wayTimeout() {
      // console.warn('wayTimeout next:', this.anim.wayMetas[0]);
      const metaLength = this.a.wayMetas[0]?.length;

      if (metaLength === undefined) {
        return console.warn('wayTimeout: empty wayMetas');
      } else if (this.animName !== 'walk') {
        return console.warn(`wayTimeout: not walking: ${this.animName}`);
      } else if (this.paused) {
        return; // This handles World pause
      }

      /** @type {NPC.NpcWayMeta} */ let wayMeta;
      if (this.distance >= metaLength - 1) {
        // Reached wayMeta's `length`, so remove/trigger respective event (+adjacents)
        while (this.a.wayMetas[0]?.length <= metaLength) {
          // console.warn('wayMeta shift', this.anim.wayMetas[0])
          this.a.prevWayMetas.push(wayMeta = /** @type {NPC.NpcWayMeta} */ (this.a.wayMetas.shift()));
          api.npcs.events.next({ key: 'way-point', npcKey: this.def.key, meta: wayMeta });
        }
      } else {
        // console.warn(
        //   'wayTimeout not ready',
        //   this.anim.wayMetas[0],
        //   this.anim.translate.currentTime,
        //   this.anim.translate.effect?.getTiming().duration,
        //   this.anim.wayMetas[0].length * this.getAnimScaleFactor(),
        // );
      }
      this.nextWayTimeout();
    },
  };
}

/**
 * Mutates provided @see npc
 * @param {NPC.NPC} npc 
 * @param {import('./WorldPixi').State} api
 * @returns {NPC.NPC}
 */
export function hotModuleReloadNpc(npc, api) {
  const { def, epochMs, s, a, doMeta, forcePaused, gmRoomId, has, navOpts, navPath, nextWalk, tr, frame, distance, time, animName } = npc;
  return Object.assign(npc, createNpc(def, api), { def, epochMs, s, a, doMeta, forcePaused, gmRoomId, has, navOpts, navPath, nextWalk, tr, frame, distance, time, animName });
}

const tracks = spineAnimNames.reduce((agg, animName) => {
  const { frameCount, headFrames, neckPositions, packedRects, rootDeltas } = spineMeta.anim[animName];
  return { ...agg,
    [animName]: {
      animName,
      bodys: packedRects,
      deltas: rootDeltas.length ? rootDeltas : null,
      heads: headFrames,
      length: frameCount,
      necks: neckPositions,
    },
  };
}, /** @type {Record<NPC.SpineAnimName, NPC.Track>} */ ({}));

const emptyTween = Object.assign(new TWEEN.Tween({}), {
  promise: () => Promise.resolve({}),
});

const emptyFn = () => {};
