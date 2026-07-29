/**
 * One spring per channel.
 *
 * Everything the books do — position, rotation, scale, tilt, the covers — is a
 * target and a spring chasing it. That is what makes the whole thing
 * interruptible: any input can change any target on any frame and nothing has
 * to be cancelled, because there is no timeline to cancel.
 */
export class Spring {
  constructor(v, k = 90, d = 19) {
    this.v = v;
    this.t = v;
    this.vel = 0;
    this.k = k;
    this.d = d;
  }

  update(dt) {
    // A long frame integrated in one step can go unstable; substep instead.
    const n = dt > 0.022 ? 3 : 1;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.vel += (this.k * (this.t - this.v) - this.d * this.vel) * h;
      this.v += this.vel * h;
    }
  }

  /** Jump to a value, killing velocity — for seating things on first frame. */
  set(v) {
    this.v = this.t = v;
    this.vel = 0;
  }
}

/** The full set of channels a book animates on. */
export const bookSprings = () => ({
  px: new Spring(0, 60, 15),
  py: new Spring(0, 60, 15),
  pz: new Spring(0, 60, 15),
  rx: new Spring(0, 60, 15),
  ry: new Spring(0, 60, 15),
  rz: new Spring(0, 60, 15),
  sc: new Spring(1, 70, 16),
  tiltX: new Spring(0, 90, 17),
  tiltY: new Spring(0, 90, 17),
  lift: new Spring(0, 80, 16),
  cover: new Spring(0, 60, 14),
  coverB: new Spring(0, 60, 14),
  drag: new Spring(0, 120, 20),
});
