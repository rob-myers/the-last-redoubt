/**
 * @template {Geom.RectJson} T
 * A spatial hash based on:
 * http://www.gamedev.net/page/resources/_/technical/game-programming/spatial-hashing-r2697
 */
export class SpatialHash {
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

  /**
   * @param {number} value 
   */
  coordToGrid(value) {
    return Math.floor(value / this.cellSize);
  }

  getNumBuckets() {
    let sum = 0;
    for (const row of this.hash.values()) {
      for (const bucket of row.values()) {
        sum += bucket.length;
      }
    }
    return sum;
  }

  // 🚧 bulk insert?

  /** @param {T} item */
  insert(item) {
    this.all.push(item);

    const minX = this.coordToGrid(item.x);
    const minY = this.coordToGrid(item.y);
    const maxX = this.coordToGrid(item.x + item.width);
    const maxY = this.coordToGrid(item.y + item.height);

    /** @type {Map<number, T[]> | undefined} */
    let row;
    for (let i = minX; i <= maxX; i++) {
      row = this.hash.get(i);
      if (row === undefined) {
         this.hash.set(i, row = new Map);
      }
      for (let j = minY; j <= maxY; j++) {
        row.get(j)?.push(item);
      }
    }
  }

  /** @param {Geom.RectJson} rect */
  retrieve(rect) {
    this.retrieved.clear();
    const minX = this.coordToGrid(rect.x);
    const minY = this.coordToGrid(rect.y);
    const maxX = this.coordToGrid(rect.x + rect.width);
    const maxY = this.coordToGrid(rect.y + rect.height);

      /** @type {Map<number, T[]> | undefined} */
    let row;
    for (let i = minX; i <= maxX; i++) {
      row = this.hash.get(i);
      if (row === undefined) {
         continue;
      }
      for (let j = minY; j <= maxY; j++) {
        row.get(j)?.forEach(item => this.retrieved.add(item));
      }
    }
    return Array.from(this.retrieved);
  }

}
