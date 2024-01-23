import { Plugin } from "pixi-viewport";

/**
 * Custom plugin to follow a display-object,
 * based on `'follow'` plugin.
 * @public
 */
export class Follow extends Plugin {
  /**
   * @public @readonly
   * @type {Required<IFollowOptions>}
   */
  options;

  /**
   * @public
   * @type {import('pixi.js').DisplayObject}
   * The target this plugin will make the viewport follow.
   */
  target;

  /**
   * @protected
   * @type {import('pixi.js').IPointData}
   * The velocity provided the viewport by following, at the current time.
   */
  velocity;

  /**
   * @param {import('pixi-viewport').Viewport} parent
   * @param {import('pixi.js').DisplayObject} target - target to follow
   * @param {IFollowOptions} options
   */
  constructor(parent, target, options) {
    super(parent);

    this.target = target;
    this.options = Object.assign({}, DEFAULT_FOLLOW_OPTIONS, options);
    this.velocity = { x: 0, y: 0 };
  }

  /**
   * @public
   * @param {number} elapsed
   * @returns {void}
   */
  update(elapsed) {
    if (this.paused) {
      return;
    }

    const center = this.parent.center;
    let toX = this.target.x;
    let toY = this.target.y;

    const distance = Math.sqrt(
      Math.pow(this.target.y - center.y, 2) +
        Math.pow(this.target.x - center.x, 2)
    );

    const deltaX = toX - center.x;
    const deltaY = toY - center.y;

    if (deltaX || deltaY) {
      // Faster when further away
      const speed = Math.max(this.options.speed, distance / 50);

      const angle = Math.atan2(toY - center.y, toX - center.x);
      const changeX = Math.cos(angle) * speed;
      const changeY = Math.sin(angle) * speed;
      const x = Math.abs(changeX) > Math.abs(deltaX) ? toX : center.x + changeX;
      const y = Math.abs(changeY) > Math.abs(deltaY) ? toY : center.y + changeY;

      this.parent.moveCenter(x, y);
      this.parent.emit("moved", { viewport: this.parent, type: "follow" });
    }
  }
}

/** @type {Required<IFollowOptions>} */
const DEFAULT_FOLLOW_OPTIONS = {
  speed: 0,
};

/**
 * @typedef IFollowOptions Options for {@link Follow}.
 * @property {number} [speed]
 * Speed to follow in px/frame (0 = teleport to location) WHEN close.
 */
