// 🚧 unused: originally intended for NPC collision prediction,
// i.e. restrict to colliders in current room close to line-segment

/**
 * @template {Geom.RectJson} T
 * A spacial (or spatial) hash based on:
 * http://www.gamedev.net/page/resources/_/technical/game-programming/spatial-hashing-r2697
 */
export class SpacialHash {
  /** @type {number} */
  cellSize;
  /** @type {Map<number, Map<number, T[]>>} */
  hash;
  /** @type {T[]} */
  all;
  /** @type {Set<T>} */
  retrieved;

  /**
   * @param {number} cellSize
   */
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.hash = new Map;
    this.all = [];
    this.retrieved = new Set;
  }

  clear() {
    this.hash.clear();
    this.all.length = 0;
  }

  getNumBuckets() {
    let sum = 0;
    for (const col of this.hash.values()) {
      for (const bucket of col.values()) {
        sum += bucket.length;
      }
    }
    return sum;
  }

  /** @param {T} item */
  insert(item) {
    this.all.push(item);

    const minX = this.ordToGrid(item.x);
    const minY = this.ordToGrid(item.y);
    const maxX = this.ordToGrid(item.x + item.width);
    const maxY = this.ordToGrid(item.y + item.height);

    /** @type {Map<number, T[]> | undefined} */
    let col;
    /** @type {T[] | undefined} */
    let bucket;
    for (let i = minX; i <= maxX; i++) {
      (col = this.hash.get(i)) ?? (this.hash.set(i, col = new Map));
      for (let j = minY; j <= maxY; j++) {
        (bucket = col.get(j)) ?? col.set(j, bucket = []);
        bucket.push(item);
      }
    }
  }

  /** @param {T[]} items */
  load(items) {
    items.forEach(item => this.insert(item));
  }

  /**
   * Real ordinate to grid ordinate.
   * @param {number} value 
   */
  ordToGrid(value) {
    return Math.floor(value / this.cellSize);
  }

  /** @param {Geom.RectJson} rect */
  retrieve(rect) {
    this.retrieved.clear();
    const minX = this.ordToGrid(rect.x);
    const minY = this.ordToGrid(rect.y);
    const maxX = this.ordToGrid(rect.x + rect.width);
    const maxY = this.ordToGrid(rect.y + rect.height);

    /** @type {Map<number, T[]> | undefined} */
    let col;
    for (let i = minX; i <= maxX; i++) {
      col = this.hash.get(i);
      if (col === undefined) {
         continue;
      }
      for (let j = minY; j <= maxY; j++) {
        col.get(j)?.forEach(item => this.retrieved.add(item));
      }
    }
    return Array.from(this.retrieved);
  }

}
