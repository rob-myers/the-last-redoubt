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
    distance: 0,
    frame: 0,
    frameDurs: [Infinity],
    frameMap: [0],
    framePtr: 0,
    neckAngle: 0,
    pendingWalk: false,
    resolveTransition: null,
    time: 0,
    turn: {
      agg: 0,
      dstDeg: -1,
      dstNodeId: -1,
    },
    tr: tracks['idle'],
    walkCancel: emptyFn,
    walkFinish: emptyFn,
    walkSpeed: def.walkSpeed,

    el: /** @type {*} */ ({}), // Fix types during migration
    s: {
      body: new Sprite(new Texture(baseTexture)),
      head: new Sprite(new Texture(baseTexture)),
    },

    anim: /** @type {*} */ ({}), // Fix types during migration
    a: {
      path: [],
      staticBounds: new Rect,
      initHeadWidth: 0,
      
      opacity: /** @type {*} */ (emptyTween),
      rotate: /** @type {*} */ (emptyTween),

      doorStrategy: 'none',
      gmRoomIds: [],
      prevWayMetas: [],
      wayMetas: [],
    },

    cancelCount: 0,
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
          onlyBody ? { alpha: targetOpacity} : [{ alpha: targetOpacity }, { alpha: targetOpacity }],
          durationMs,
        )).promise();
      } catch (e) {// Reset opacity if cancelled
        [this.s.body, this.s.head].forEach(s => s.alpha = 1);
        throw Error('cancelled: opacity animation');
      }
    },
    async animateRotate(targetRadians, durationMs, throwOnCancel) {
      this.a.rotate.stop();

      const srcRadians = this.getAngle();
      let deltaRadians = geom.radRange(targetRadians - srcRadians);
      if (deltaRadians > Math.PI) deltaRadians -= 2 * Math.PI;

      await (this.a.rotate = api.tween(this.s.body)
        .to({ rotation: srcRadians + deltaRadians }, durationMs)
        .onUpdate(() => this.updateHead())
        .easing(TWEEN.Easing.Quadratic.Out)
      ).promise();
    },
    async awaitTransition() {
      if (this.frameMap.length > 1) {
        return new Promise(resolve => this.resolveTransition = () => {
          this.resolveTransition = null;
          resolve();
        });
      }
    },
    async cancel(overridePaused = false) {
      if (this.forcePaused && !overridePaused) {
        throw Error('frozen: cannot cancel');
      }
      info(`cancel: cancelling ${this.def.key}`);
      const cancelCount = ++this.cancelCount;
      this.clearWayMetas();

      this.a.opacity.stop();
      this.a.rotate.stop();
      this.walkCancel(new Error('cancelled: walk'));

      this.paused = false;
      if (!this.forcePaused) {
        this.s.body.tint = 0xffffff;
        this.s.head.tint = 0xffffff;
      }

      if (this.pendingWalk) {
        await api.lib.firstValueFrom(api.npcs.events.pipe(
          api.lib.filter(e => e.key === "stopped-walking" && e.npcKey === this.key)
        ));
      }
      if (cancelCount !== this.cancelCount) {
        throw Error('cancelled: cancel was cancelled');
      }
      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
    },
    canLook() {
      return (
        this.animName === 'idle' ||
        this.animName === 'idle-breathe' ||
        this.animName === 'idle-straight'
      ) && !this.doMeta;
    },
    changeClass(npcClassKey) {
      this.classKey = npcClassKey;
    },
    clearWayMetas() {
      // console.log("CLEARED wayMetas");
      this.a.wayMetas.length = 0;
      this.a.prevWayMetas.length = 0;
    },
    computeAnimAux() {
      const radius = this.getRadius();
      this.aux.outsetWalkBounds = Rect.fromPoints(...this.a.path).outset(radius);
      this.aux.edges = this.a.path.flatMap((p, i) => this.a.path[i + 1]?.clone().sub(p) ?? []);
      this.aux.angs = this.aux.edges.map(e => precision(Math.atan2(e.y, e.x)));
      this.aux.elens = this.aux.edges.map(e => e.length);
      const reduced = this.aux.elens.reduce((agg, length) => {
        agg.total += length;
        agg.sofars.push(agg.sofars[agg.sofars.length - 1] + length);
        return agg;
      }, { sofars: [0], total: 0 });
      this.aux.sofars = reduced.sofars
      this.aux.total = reduced.total;
      this.aux.index = 0;
    },
    computeWayMetaLength(navMeta) {
      if (navMeta.key === 'at-door') {
        const gm = api.gmGraph.gms[navMeta.gmId];
        const navPoint = gm.inverseMatrix.transformPoint(this.a.path[navMeta.index].clone());
        const door = gm.doors[navMeta.doorId];
        const distanceToDoor = Math.abs(door.normal.dot(navPoint.sub(door.seg[0])));
        // change length so npc is close to door
        return Math.max(0, this.aux.sofars[navMeta.index] + distanceToDoor - (this.getRadius() + 5));
      } else {
        return this.aux.sofars[navMeta.index];
      }
    },
    async do(point, opts = {}) {
      if (!Vect.isVectJson(point)) {
        throw Error('point expected');
      }
      if (this.forcePaused) {
        throw Error('paused: cannot do');
      }
      point.meta ??= {};
      
      // Assume point.meta.door || point.meta.do | (point.meta.nav && npc.doMeta)
      // i.e. (1) door, (2) do point, or (3) non-do nav point whilst at do point
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
        return;
      }

      // Handle (point.meta.nav && npc.doMeta) || point.meta.do
      const onNav = api.npcs.isPointInNavmesh(this.getPosition());
      if (!point.meta.do) {// point.meta.nav && npc.doMeta
        this.doMeta = null;
        if (onNav) {
          const navPath = api.npcs.getGlobalNavPath(this.getPosition(), point);
          await this.walk(navPath);
        } else if (api.npcs.canSee(this.getPosition(), point, this.getInteractRadius())) {
          await this.fadeSpawn(point);
        } else {
          throw Error('cannot reach navigable point')
        }
        return;
      } else if (onNav) {// nav -> do point
        this.doMeta = null;
        await this.onMeshDoMeta(point, { ...opts, preferSpawn: !!point.meta.longClick });
        this.doMeta = point.meta;
      } else {// off nav -> do point
        await this.offMeshDoMeta(point, opts);
        this.doMeta = point.meta;
      }
    },
    everWalked() {
      return true; // Fix types during migration
    },
    extendNextWalk(...points) {// 👈 often a single point
      const currentNavPath = this.navPath;
      if (!this.isWalking() || !currentNavPath || currentNavPath.path.length === 0) {
        return warn(`extendNextWalk: ${this.key} must be walking ( ${this.animName})`);
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
      this.a.wayMetas = this.a.wayMetas.filter(meta => !shouldRemove(meta));
    },
    async followNavPath(navPath, doorStrategy) {
      const { path, navMetas: globalNavMetas, gmRoomIds } = navPath;
      this.navPath = navPath; // needn't start from npc position
      this.a.path = path.map(Vect.from);
      // for decor collisions
      this.a.gmRoomIds = gmRoomIds;
      this.a.doorStrategy = doorStrategy ?? 'none';
      // reset to default speed?
      this.walkSpeed = this.def.walkSpeed;
      this.turn.dstNodeId = -1;

      this.clearWayMetas();
      this.computeAnimAux(); // Convert navMetas to wayMetas:
      this.a.wayMetas = globalNavMetas.map((navMeta) => ({
        ...navMeta,
        length: this.computeWayMetaLength(navMeta),
      }));

      this.nextWalk = null;
      this.startAnimation('walk');

      try {
        info(`followNavPath: ${this.key} started walk`);
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          this.walkFinish = resolve;
          this.walkCancel = reject;
          this.updateWayMetas(); // wayEvents of length 0
        }));
        info(`followNavPath: ${this.key} finished walk`);
      } catch (e) {
        info(`followNavPath: ${this.key} cancelled walk`);
        throw e;
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
        const nextIndex = this.aux.sofars.findIndex(soFar => soFar > this.distance);
        return nextIndex === -1 ? null : this.a.path[nextIndex].clone();
      } else {
        return null;
      }
    },
    getTargets() {
      if (this.isWalking()) {
        const nextIndex = this.aux.sofars.findIndex(soFar => soFar > this.distance);
        return nextIndex === -1 ? [] : this.a.path.slice(nextIndex).map(p => p.clone());
      } else {
        return [];
      }
    },
    getWalkAnimDef() {// Fix types during migration
      return /** @type {*} */ ({});
    },
    getWalkBounds() {
      return this.aux.outsetWalkBounds;
    },
    getWalkCurrentTime() {
      return 0; // Fix types during migration
    },
    getWalkCycleDuration(entireWalkMs) {
      return 0; // Fix types during migration
    },
    getWalkSegBounds(withNpcRadius) {
      return withNpcRadius ? this.aux.outsetSegBounds : this.aux.segBounds;
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
    isWalking(requireMoving) {
      return this.animName === 'walk'
        && this.resolveTransition === null // Avoids transition to idle
        && (!requireMoving || !this.isPaused());
    },
    async lookAt(point, opts = {}) {
      if (!Vect.isVectJson(point)) {
        throw Error(`invalid point: ${JSON.stringify(point)}`);
      }
      if (this.forcePaused) {
        throw Error('paused: cannot look');
      }
      if (!opts.force && !this.canLook()) {
        throw Error('cannot look');
      }
      const position = this.getPosition();
      const direction = Vect.from(point).sub(position);
      if (!(direction.x === 0 && direction.y === 0)) {
        const targetRadians = Math.PI/2 + Math.atan2(direction.y, direction.x);
        await this.animateRotate(
          targetRadians,
          opts.ms ? opts.ms * geom.compareAngles(this.getAngle(), targetRadians) : 0,
          true, // throw on cancel
        );
      }
    },
    nextWayTimeout() {
     // Fix types during migration
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
      
      const closeVis = api.npcs.canSee(src, point, this.getInteractRadius());

      if (api.npcs.isPointInNavmesh(decorPoint) && !(opts.preferSpawn && closeVis)) {
        // Walk, [Turn], Do
        const navPath = api.npcs.getGlobalNavPath(this.getPosition(), decorPoint);
        await this.walk(navPath);
        typeof meta.orient === 'number' && await this.animateRotate((meta.orient + 90) * (Math.PI / 180), 100);
        this.startAnimationByMeta(meta);
        return;
      }

      if (!opts.suppressThrow && !closeVis) {
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

      info(`pause: pausing ${this.def.key}`);
      this.a.opacity.pause();
      this.a.rotate.pause();
      this.paused = true;

      if (this.forcePaused) {
        this.s.body.tint = 0xffcccc;
        this.s.head.tint = 0xffcccc;
      } else {
        this.s.body.tint = 0xaaaaaa;
        this.s.head.tint = 0xaaaaaa;
      }
      this.s.body.alpha = Math.max(0.1, this.s.body.alpha);
      this.s.head.alpha = Math.max(0.1, this.s.head.alpha);

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'paused' });
    },
    resume(forced = true) {
      if (this.forcePaused && !forced) {
        return;
      }
      info(`resume: resuming ${this.def.key}`);

      this.a.opacity.resume();
      this.a.rotate.resume();
      this.forcePaused = false;
      this.paused = false;
      this.s.body.tint = 0xffffff;
      this.s.head.tint = 0xffffff;

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'resumed' });
    },
    setupAnim(animName) {
      if (animName === 'walk') {
        if (this.animName === animName) {
          // preserve walk
        } else {
          this.time = 0; // 🚧 remove hard-coding:
          this.frame = Math.random() > 0.5 ? 0 : 16;
        }
      } else {
        this.time = 0;
        this.frame = 0;
      }

      this.animName = animName;
      this.tr = tracks[animName];
      this.resolveTransition = null;
      this.framePtr = this.frame;
      this.frameMap = this.tr.bodys.map((_, i) => i);
      this.distance = 0;
      
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
        case 'idle':
        case 'idle-breathe':
        case 'idle-straight':
        case 'lie':
        case 'sit':
        case 'straight-to-idle':
          this.a.rotate.stop();
          this.clearWayMetas();
          this.updateStaticBounds();
          if (animName === 'sit') {
            this.obscureBySurfaces();
          }
          break;
        case 'walk':
          break;
        default:
          throw testNever(animName, { suffix: 'create-npc.startAnimation' });
      }
      this.setupAnim(animName);
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
    setWalkSpeed(walkSpeed, permWhileWalk = false) {
      if (this.tr.deltas !== null) {
        permWhileWalk && (this.def.walkSpeed = walkSpeed);
        this.frameDurs = this.tr.deltas.map(x => x / walkSpeed);
      } else {// if not walking, perm change speed
        this.def.walkSpeed = walkSpeed;
      }

      if (this.walkSpeed === walkSpeed) {
        return; // Loop protect?
      }
      const prevSpeed = this.walkSpeed;
      this.walkSpeed = walkSpeed;
      api.npcs.events.next({ key: 'changed-speed', npcKey: this.key, prevSpeed, speed: walkSpeed });
    },
    updateHead() {
      const { body, head } = this.s;
      const { angle, width } = this.tr.heads[this.frame];
      const neckPos = this.tr.necks[this.frame];
      const radians = body.rotation;
      head.angle = angle + body.angle + this.neckAngle;
      head.scale.set(width / this.a.initHeadWidth);
      head.x = body.x + Math.cos(radians) * neckPos.x - Math.sin(radians) * neckPos.y;
      head.y = body.y + Math.sin(radians) * neckPos.x + Math.cos(radians) * neckPos.y;
    },
    updateMotion() {
      if (this.tr.deltas == null || this.resolveTransition !== null) {
        return; // No motion, or walk transition
      }

      this.distance += this.tr.deltas[this.frame];
      this.updateWayMetas(); // ones we're about to step over
      
      // move along path
      const index = this.aux.index;
      const vertex = this.a.path[index]
      if (index === this.a.path.length - 1) {// goto end
        this.s.body.position.copyFrom(vertex);
        return;
      } else {// position on track using `this.distance`
        const ratio = (this.distance - this.aux.sofars[index]) / this.aux.elens[index];
        const edge = this.aux.edges[index];
        this.s.body.position.set(vertex.x + ratio * edge.x, vertex.y + ratio * edge.y);
      }

      // smooth turn towards current path angle
      if (this.turn.dstNodeId !== index) {
        this.turn.dstNodeId = index;
        this.turn.agg = 0;
        this.turn.dstDeg = (this.aux.angs[index] + Math.PI/2) * (180 / Math.PI);
      }
      this.s.body.angle = geom.lerpDegrees(
        this.s.body.angle,
        this.turn.dstDeg,
        this.turn.agg += this.frameDurs[this.frame] * 5 * (40 / this.walkSpeed),
      );

    },
    updateRoomWalkBounds(srcIndex) {
      // Fix types during migration
    },
    updateSprites() {
      this.s.body.texture._uvs.set(
        /** @type {Rectangle} */ (this.tr.bodys[this.frame]),
        baseTexture,
        0,
      );
      this.updateHead();
      this.s.bounds?.position.copyFrom(this.s.body.position);
    },
    updateStaticBounds() {
      const pos = this.getPosition();
      const radius = this.getRadius();
      this.a.staticBounds.set(pos.x - radius, pos.y - radius, 2 * radius, 2 * radius);
    },
    updateTime(deltaRatio) {
      if (this.paused === true || this.frameMap.length === 1) {
        return;
      }
      // Could skip multiple frames in single update via low fps
      // https://github.com/pixijs/pixijs/blob/dev/packages/sprite-animated/src/AnimatedSprite.ts
      let lag = ((this.time % 1) * this.frameDurs[this.frame]) + (deltaRatio * (1 / 60));
      while (lag >= this.frameDurs[this.frame]) {
        lag -= this.frameDurs[this.frame];

        this.time++;
        if (++this.framePtr === this.frameMap.length) {
          this.framePtr = 0;
          this.resolveTransition?.();
        }
        // change frame before, else transition can flicker
        this.frame = this.frameMap[this.framePtr];
        this.updateMotion();
        this.updateSprites();
      }

      this.time = Math.floor(this.time) + (lag / this.frameDurs[this.frame]);
    },
    updateWalkSegBounds(index) {
      const { path } = this.a;
      this.aux.segBounds.copy(Rect.fromPoints(path[index], path[index + 1]));
      this.aux.outsetSegBounds.copy(this.aux.segBounds).outset(this.getRadius());
    },
    updateWayMetas() {
      /** @type {NPC.NpcWayMeta} */ let wayMeta;
      while (this.a.wayMetas[0]?.length <= this.distance) {
        this.a.prevWayMetas.push(wayMeta = /** @type {NPC.NpcWayMeta} */ (this.a.wayMetas.shift()));
        api.npcs.events.next({ key: 'way-point', npcKey: this.key, meta: wayMeta });
      }
    },
    async walk(navPath, opts = {}) {
      if (api.lib.isVectJson(navPath)) {
        navPath = api.npcs.getGlobalNavPath(this.getPosition(), navPath, this.navOpts);
      }
      if (!api.lib.verifyGlobalNavPath(navPath)) {
        throw Error(`invalid global navPath: ${JSON.stringify({ npcKey: this.key, navPath, opts })}`);
      }

      if (navPath.path.length === 0) {
        return;
      }
      if (this.isBlockedByOthers(navPath.path[0], navPath.path[1])) {
        throw new Error(`cancelled: blocked by other`);
      }

      const initialWarp = this.getPosition().distanceTo(navPath.path[0]) > 0.01;
      if (!initialWarp && navPath.path[1]) {
        await this.lookAt(navPath.path[1], { force: true, ms: 500 });
      }

      try {
        this.pendingWalk = true;
        
        do {
          api.npcs.events.next({
            key: 'started-walking', // 🔔 change name when extends?
            npcKey: this.key,
            navPath,
            continuous: this.nextWalk !== null || !initialWarp,
            extends: this.nextWalk !== null,
          });

          await this.followNavPath(navPath, opts.doorStrategy);

        } while (this.nextWalk && (navPath = this.nextWalk.navPath));

      } finally {
        await this.walkToIdle();
        this.pendingWalk = false;
        this.nextWalk = null;
        this.startAnimation('idle-breathe');
        api.npcs.events.next({ key: 'stopped-walking', npcKey: this.key });
      }
    },
    async walkToIdle() {
      if (this.animName !== 'walk' || this.resolveTransition) {
        return; // prevent concurrent transitions
      }

      this.framePtr = 0;
      // 🔔 Assume `[1st-cross, 1st-step, 2nd-cross, 2nd-step]` where 1st-cross `0`
      const frames = /** @type {number[]} */ (spineMeta.anim.walk.extremeFrames);
      const base = this.tr.bodys.map((_, i) => i); // [0...maxFrame]
      const nextId = frames.findIndex(x => x > this.frame);
      switch (nextId) {
        case  1: this.frameMap = base.slice(0, this.frame + 1).reverse(); break;
        case  2: this.frameMap = base.slice(this.frame, frames[2]); break;
        case  3: this.frameMap = base.slice(frames[2], this.frame + 1).reverse(); break;
        case -1: this.frameMap = base.slice(this.frame); break;
      }
      if ((nextId === 1 || nextId === 3) && this.frameMap.length <= 4) {
        this.frameDurs[this.frameMap[0]] = 300 / 1000; // Hard-stop
      }
      await this.awaitTransition();

      this.startAnimation('straight-to-idle');
      this.frameDurs = this.frameDurs.map(x => x * 0.3);
      await this.awaitTransition();
    },
    wayTimeout() {
      // Fix types during migration
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
