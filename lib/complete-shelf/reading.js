/**
 * Reading mode: the open-book rig and the page turn.
 *
 * Owns everything about a book once it is open — the rig itself, the
 * continuous page position, and the drag that turns leaves. The shelf engine
 * only opens it, closes it and calls `update` each frame.
 *
 * Page position is continuous rather than an index: `p` runs from 0 (shut) to
 * L (the last leaf), so a drag can sit halfway through a turn and a fling can
 * carry across several.
 */

import { clamp } from "@/lib/math";
import { createOpenBook } from "./open-book";

const STIFF = 130;
const DAMP = 2 * Math.sqrt(STIFF); // critically damped — glide, never bounce
const FLING = 0.018; // page velocity that carries a turn over

export function createReader({ scene, camera, controls, hitTest, onMode, controlsOn }) {
  const r = {
    rig: null,
    p: 0, // continuous read position across the leaves
    vel: 0,
    target: 0,
    grabbing: false,
    closing: false,
    grabX: 0,
    grabP: 0,
  };

  function open(entry, focal) {
    if (r.rig) return;
    r.rig = createOpenBook(entry.book);
    r.rig.group.position.copy(focal);
    r.rig.group.rotation.set(-0.05, 0, 0);
    scene.add(r.rig.group);
    entry.mesh.visible = false;
    r.p = 0;
    r.vel = 0;
    r.target = 1; // swing the cover open
    r.closing = false;
    // pull the camera back a touch — an open book is wider than a spine
    camera.position.set(focal.x, focal.y + 0.2, focal.z + 6.2);
    controls.target.copy(focal);
    controls.update();
    onMode("reading");
  }

  /** Ask for the cover to shut; the rig is torn down once it lands. */
  function close() {
    if (!r.rig) return;
    r.closing = true;
    r.target = 0;
  }

  function teardown(entry) {
    if (!r.rig) return;
    scene.remove(r.rig.group);
    r.rig.dispose();
    r.rig = null;
    r.closing = false;
    if (entry) entry.mesh.visible = true;
  }

  function turnPage(dir) {
    if (!r.rig) return;
    r.target = clamp(Math.round(r.target) + dir, 0, r.rig.L);
    if (r.target === 0) r.closing = true;
  }

  /* ---- page drag. Bound in the capture phase by the engine so it pre-empts
     OrbitControls' rotate; dragging empty space still orbits. ---- */
  function onDown(e) {
    if (!r.rig || !hitTest(e, r.rig.group)) return;
    r.grabbing = true;
    r.grabX = e.clientX;
    r.grabP = r.p;
    r.vel = 0;
    controls.enabled = false;
  }

  function onMove(e, width) {
    if (!r.grabbing || !r.rig) return;
    const k = 1 / (width * 0.42); // ~one page per 42% of the width dragged
    const np = clamp(r.grabP + (r.grabX - e.clientX) * k, 0, r.rig.L);
    r.vel = np - r.p;
    r.p = np;
  }

  function onUp() {
    if (!r.grabbing) return;
    r.grabbing = false;
    // read live, not captured at grab time — the transition may have finished
    // mid-drag and handed the camera over to OrbitControls
    controls.enabled = controlsOn();
    if (!r.rig) return;
    // weighted settle: a fling carries it over, a soft drag falls back
    let tgt = Math.round(r.p);
    if (r.vel > FLING) tgt = Math.floor(r.p) + 1;
    else if (r.vel < -FLING) tgt = Math.ceil(r.p) - 1;
    r.target = clamp(tgt, 0, r.rig.L);
    if (r.target === 0) r.closing = true;
  }

  /** @returns true once a closing book has shut and wants tearing down */
  function update(dt) {
    if (!r.rig) return false;
    if (!r.grabbing) {
      r.vel += (-STIFF * (r.p - r.target) - DAMP * r.vel) * dt;
      r.p += r.vel * dt;
      if (Math.abs(r.p - r.target) < 0.0008 && Math.abs(r.vel) < 0.0025) {
        r.p = r.target;
        r.vel = 0;
      }
    }
    r.rig.setP(r.p);
    // curl reacts to turn speed — a flick flexes the paper more than a slow drag
    r.rig.setCurl(0.22 + Math.min(Math.abs(r.vel) * 6, 0.26));
    return r.closing && !r.grabbing && r.p < 0.01;
  }

  /** Debug hook for static screenshots — state-driven, not time-driven. */
  function setPage(p) {
    r.p = p;
    r.target = p;
    r.vel = 0;
  }

  return {
    state: r,
    isOpen: () => r.rig !== null,
    open,
    close,
    teardown,
    turnPage,
    onDown,
    onMove,
    onUp,
    update,
    setPage,
  };
}
