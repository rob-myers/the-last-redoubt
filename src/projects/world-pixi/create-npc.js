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
      animName: 'idle',
      paused: false, // 👈 new
      walkSpeed: def.walkSpeed,

      shared: sharedAnimData,

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
      
      opacity: emptyTween,
      rotate: emptyTween,
      deferred: { resolve: emptyFn, reject: emptyFn },

      durations: getAnimDurations(sharedAnimData, def.walkSpeed),
      normalizedTime: 0,
      distance: 0, // 👈 implement during sprite update

      neckAngle: 0,
      headSkinName: npcClassToSpineHeadSkin[def.classKey],
      initHeadWidth: 0,
      
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
    unspawned: true, // old

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
        await (this.a.rotate = api.tween(this.s.body)
          .to({ rotation: targetRadians }, durationMs)
          .onUpdate(() => this.updateHead())
          .easing(TWEEN.Easing.Quadratic.Out))
          .promise()
        ;
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
      this.a.deferred.reject('cancelled');

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
    changeClass(npcClassKey) {
      this.classKey = npcClassKey;
      this.a.headSkinName = npcClassToSpineHeadSkin[npcClassKey];
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
      // warn('START followNavPath')
      // can jump: path needn't start from npc position
      this.navPath = navPath;
      this.a.path = path.map(Vect.from);
      // for decor collisions
      this.a.gmRoomIds = gmRoomIds;
      this.a.doorStrategy = doorStrategy ?? 'none';
      // reset to default speed?
      this.a.walkSpeed = this.def.walkSpeed;

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

      try {
        console.log(`followNavPath: ${this.key} started walk`);
        await new Promise((resolve, reject) => {
          this.a.deferred.resolve = resolve;
          this.a.deferred.reject = reject;
        });
        console.log(`followNavPath: ${this.key} finished walk`);
        this.wayTimeout(); // immediate else startAnimation('idle') will clear
      } catch (e) {
        console.log(`followNavPath: ${this.key} cancelled walk`);
        throw Error('cancelled');
      } finally {// Reset speed to default?
        this.a.walkSpeed = this.def.walkSpeed;
      }
    },
    getAnimScaleFactor() {
      return 1000 * (1 / this.getSpeed()); // ms per world-unit
    },
    getAngle() {
      return this.s.body.rotation;
    },
    getFrame() {
      return Math.floor(this.a.normalizedTime) % this.a.shared.frameCount;
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
      return this.a.walkSpeed;
    },
    getTarget() {
      if (this.isWalking()) {
        const nextIndex = this.a.aux.sofars.findIndex(soFar => soFar > this.a.distance);
        // Expect -1 iff at final point
        return nextIndex === -1 ? null : this.a.path[nextIndex].clone();
      } else {
        return null;
      }
    },
    getTargets() {
      if (this.isWalking()) {
        const nextIndex = this.a.aux.sofars.findIndex(soFar => soFar > this.a.distance);
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
      return ['idle', 'idle-breathe'].includes(this.a.animName);
    },
    isPaused() {
      return this.a.paused;
    },
    isPlayer() {
      return this.key === api.npcs.playerKey;
    },
    isPointBlocked(point) {
      // Check if blocked by nearby NPC
      const closeNpcs = api.npcs.getCloseNpcs(this.key);
      if (closeNpcs.some(other =>
        other.intersectsCircle(point, npcRadius)
        && api.npcs.handleBunkBedCollide(other.doMeta ?? undefined, point.meta)
      )) {
        return true;
      } else {
        return false;
      }
    },
    isWalking() {
      return this.a.animName === 'walk';
    },
    async lookAt(point) {
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
      await this.animateRotate(targetRadians, 1 * 1000);
    },
    nextWayTimeout() {
      if (this.a.wayMetas[0]) {
        const msToWait = (this.a.wayMetas[0].length - this.a.distance) * this.getAnimScaleFactor();
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
            ? src.equals(point) ? undefined : Vect.from(point).sub(src).angle
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
      this.a.paused = true;

      if (this.a.animName === 'walk') {
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
      this.forcePaused = false;
      this.a.paused = false;

      if (this.a.animName === 'walk') {
        this.nextWayTimeout();
      }

      api.npcs.events.next({ key: 'npc-internal', npcKey: this.key, event: 'resumed' });
    },
    setupAnim(animName) {
      const { a, s } = this;
      a.animName = animName;
      a.normalizedTime = 0;
      a.distance = 0;
      
      const { headOrientKey } = spineAnimToSetup[animName]
      const { animBounds, headFrames, neckPositions } = spineMeta.anim[animName];
      
      a.shared = getSharedAnimData(animName);
      a.durations = getAnimDurations(a.shared, this.getSpeed());

      // Changing frame width/height later deforms image
      const bodyRect = a.shared.bodyRects[a.normalizedTime];
      const headRect = spineMeta.head[a.headSkinName].packedHead[headOrientKey];
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
      s.body.rotation = this.getAngle();
      a.initHeadWidth = headRect.width;

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
    // ℹ️ currently NPC.SpriteSheetKey equals NPC.SpineAnimName
    // 🚧 fix "final walk frame jerk" elsewhere
    startAnimation(animName) {
      this.a.animName = animName;
      this.a.rotate.stop();
      
      switch (animName) {
        case 'walk': {
          this.a.rotate.stop(); // fix `npc do` orientation
          this.setupAnim(animName);

          // 🚧 chained rotation tweens
          // - can use `aux.sofars[i] / aux.total`
          // - tween remade if speed changes
          const totalMs = this.a.aux.total * this.getAnimScaleFactor();
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
      if (!(this.a.animName === 'walk' && temporary)) {
        this.def.walkSpeed = walkSpeed;
      }
      if (this.a.walkSpeed === walkSpeed) {
        return; // Avoid infinite loop?
      }
      if (this.a.animName === 'walk') {
        this.a.durations = getAnimDurations(this.a.shared, walkSpeed);
        // 🚧 chained rotate tween
        const totalMs = (this.a.aux.total - this.a.distance) * this.getAnimScaleFactor();
        this.a.rotate.stop().to({}, totalMs).start();
      }
      api.npcs.events.next({ key: 'changed-speed', npcKey: this.key, prevSpeed: this.a.walkSpeed, speed: walkSpeed });
      this.a.walkSpeed = walkSpeed;
    },
    updateHead() {
      const { body, head } = this.s;
      const { headFrames, neckPositions } = this.a.shared;

      const currFrame = this.getFrame();
      const { angle, width } = headFrames[currFrame];
      const neckPos = neckPositions[currFrame];
      const radians = body.rotation;

      head.angle = angle + body.angle + this.a.neckAngle;
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
      const currFrame = this.getFrame();
      const { bodyRects, rootDeltas } = this.a.shared;
      const { body, bounds } = this.s;

      body.texture._uvs.set(/** @type {Rectangle} */ (bodyRects[currFrame]), baseTexture, 0);
      const radians = body.rotation;
      if (rootDeltas.length) {// in pixi.js 0 degrees ~ north ~ negative y-axis
        const rootDelta = rootDeltas[currFrame];
        body.x += rootDelta * Math.sin(radians);
        body.y -= rootDelta * Math.cos(radians);
      }

      this.updateHead();
      bounds?.position.copyFrom(body.position);
    },
    updateStaticBounds() {
      const pos = this.getPosition();
      const radius = this.getRadius();
      this.a.staticBounds.set(pos.x - radius, pos.y - radius, 2 * radius, 2 * radius);
    },
    updateTime(deltaRatio) {
      if (this.a.paused === true || this.a.shared.frameCount === 1) {
        return;
      }
      const deltaSecs = deltaRatio * (1 / 60);
      let frame = this.getFrame(), shouldUpdate = false;

      // Could skip multiple frames in single update via low fps
      // https://github.com/pixijs/pixijs/blob/dev/packages/sprite-animated/src/AnimatedSprite.ts
      let lag = ((this.a.normalizedTime % 1) * this.a.durations[frame]) + deltaSecs;
      while (lag >= this.a.durations[frame]) {
        lag -= this.a.durations[frame];
        this.a.normalizedTime++;
        this.a.distance += this.a.shared.rootDeltas[frame];
        frame = this.getFrame();
        shouldUpdate = true;
      }
      this.a.normalizedTime = Math.floor(this.a.normalizedTime) + lag / this.a.durations[frame];

      shouldUpdate && this.updateSprites();
    },
    updateWalkSegBounds(index) {
      const { aux, path } = this.a;
      aux.index = index;
      aux.segBounds.copy(Rect.fromPoints(path[index], path[index + 1]));
      aux.outsetSegBounds.copy(aux.segBounds).outset(this.getRadius());
    },
    async walk(navPath, opts = {}) {
      if (!api.lib.verifyGlobalNavPath(navPath)) {
        this.nextWalk = null;
        throw Error(`invalid global navpath: ${JSON.stringify({ npcKey: this.key, navPath, opts })}`);
      }
      if (this.forcePaused) {
        this.nextWalk = null;
        throw Error('paused: cannot walk');
      }
      if (this.isPaused()) {
        // isWalking cancel caused jerky extended walk?
        await this.cancel();
      }
      if (navPath.path.length === 0) {
        this.nextWalk = null;
        return;
      }

      try {
        if (this.isPointBlocked(
          navPath.path[0],
          this.getPosition().equalsAlmost(navPath.path[0])
        )) {// start of navPath blocked
          throw new Error('cancelled');
        }

        // Walk along navpath, possibly throwing 'cancelled' on collide
        await this.followNavPath(navPath, opts.doorStrategy);

        if (this.nextWalk) {
          await this.walk(this.nextWalk.navPath, opts);
        }

        this.startAnimation('idle');
      } catch (err) {
        if (!opts.throwOnCancel && err instanceof Error && err.message === 'cancelled') {
          return warn(`walk cancelled: ${this.key}`);
        }
        throw err;
      } finally {
        api.npcs.events.next({ key: 'stopped-walking', npcKey: this.key });
      }
    },
    // 🚧 avoid many short timeouts?
    wayTimeout() {
      // console.warn('wayTimeout next:', this.anim.wayMetas[0]);
      const metaLength = this.a.wayMetas[0]?.length;

      if (metaLength === undefined) {
        return console.warn('wayTimeout: empty wayMetas');
      } else if (this.a.animName !== 'walk') {
        return console.warn(`wayTimeout: not walking: ${this.a.animName}`);
      } else if (this.a.paused) {
        return; // This handles World pause
      }

      /** @type {NPC.NpcWayMeta} */ let wayMeta;
      if (this.a.distance >= metaLength - 1) {
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
  const { def, epochMs, s, a, doMeta, forcePaused, gmRoomId, has, navOpts, navPath, nextWalk } = npc;
  return Object.assign(npc, createNpc(def, api), { def, epochMs, s, a, doMeta, forcePaused, gmRoomId, has, navOpts, navPath, nextWalk });
}

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

/** @type {NPC.TweenExt} */
const emptyTween = Object.assign(new TWEEN.Tween({}), {
  promise: () => Promise.resolve({}),
});

const emptyFn = () => {};

const sharedAnimData = /** @type {Record<NPC.SpineAnimName, NPC.SharedAnimData>} */ (
  {}
);
